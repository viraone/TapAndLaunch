"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { NETWORK_ERROR, SERVER_ERROR } from "@/lib/friendly-errors";
import { toast } from "sonner";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Loader2,
  Pencil,
  Play,
  Rocket,
  Sparkles,
  Undo2,
  Redo2,
} from "lucide-react";
import { tileGradient, tileInitial } from "@/lib/apps/tile";
import { buildChecklist, type ChecklistStepId } from "@/lib/apps/checklist";
import { BuilderPhoneNotice } from "@/components/builder/BuilderPhoneNotice";
import { AddSectionBar } from "@/components/builder/AddSectionBar";
import { FIELD_FOCUS_EVENT, flashField, type FieldFocusDetail } from "@/lib/builder/field-link";
import { Inspector } from "@/components/builder/Inspector";
import { AskAiBar, type AskScope } from "@/components/builder/AskAiBar";
import { planCurrentPage, planSite, type PendingChange } from "@/lib/builder/agent-plan";
import { suggestNext, withoutAi, type Suggestion, type SuggestionEvent } from "@/lib/apps/suggestions";
import { ASK_AI_VISIBLE } from "@/lib/ai/visible";
import type { Draft, DraftBlock } from "@/lib/ai/builder-ops";
import { PageTabs, slugify, type PageActions } from "@/components/builder/PageTabs";
import { SortableBlockItem } from "@/components/builder/SortableBlockItem";
import {
  PreviewFrame,
  DeviceFrameSwitcher,
  type DeviceFrame,
} from "@/components/builder/MobilePreviewFrame";
import { SiteHeader } from "@/components/pwa-runtime/SiteHeader";
import { SiteFooter } from "@/components/pwa-runtime/SiteFooter";
import { AnnouncementBar } from "@/components/pwa-runtime/SiteNotices";
import { AppSettingsDialog } from "@/components/builder/AppSettingsDialog";
import { BottomNav } from "@/components/pwa-runtime/BottomNav";
import { AppHeader } from "@/components/pwa-runtime/AppHeader";
import { createClient } from "@/lib/supabase/client";
import { BLOCK_TYPE_LABELS, defaultConfigFor } from "@/lib/builder/block-defaults";
import type { BuilderBlock } from "@/components/builder/types";
import type { ThemeConfig, BlockConfig, BlockType, Database } from "@/types/database";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];
type PageRow = Database["public"]["Tables"]["pages"]["Row"];
type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];

function toBuilderBlock(row: BlockRow): BuilderBlock {
  // Safe by construction: `type` narrows `config` at the DB layer via the
  // same union this file uses, just not provably to TypeScript across the
  // jsonb boundary.
  return {
    id: row.id,
    type: row.type,
    config: row.config,
    minTier: row.min_tier,
  } as BuilderBlock;
}

export function BuilderClient({
  app,
  rootDomain,
  initialPages,
  initialPageId,
  initialBlocks,
  hasVisit,
  contentOnOtherPages,
  mapsEnabled,
  domainsEnabled,
  recentEvents,
}: {
  app: AppRow;
  rootDomain: string;
  initialPages: PageRow[];
  initialPageId: string;
  initialBlocks: BlockRow[];
  /** Someone has already opened the published app. */
  hasVisit: boolean;
  /** Blocks exist on pages other than the one opened first. */
  contentOnOtherPages: boolean;
  /** Live food / Gas prices (Google Maps) are switched on for this organization. */
  mapsEnabled: boolean;
  /** Custom domains are set up on this server (Vercel keys present). */
  domainsEnabled: boolean;
  /** Upcoming events, for "Next up". */
  recentEvents: SuggestionEvent[];
}) {
  const supabase = createClient();

  const [currentApp, setCurrentApp] = useState(app);
  const [pages, setPages] = useState(initialPages);
  const [currentPageId, setCurrentPageId] = useState(initialPageId);
  const [blocks, setBlocks] = useState<BuilderBlock[]>(
    initialBlocks.map(toBuilderBlock),
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  // A website-layout app opens on its Desktop preview (that's the point of the layout); an app opens on iPhone.
  const [device, setDevice] = useState<DeviceFrame>(app.theme.layout === "website" ? "desktop" : "ios");
  const inspectorRef = useRef<HTMLElement>(null);
  // "Edit" shows the sections to arrange and change; "Try it" loads the real app at its own address inside the phone,
  // so a tap on a cuisine or a Book link does what it will do for a visitor. A draft needs a preview key for that
  // (api/apps/[id]/preview); every switch into Try it saves first and loads afresh, so it always shows the latest edits.
  const [mode, setMode] = useState<"edit" | "try">("edit");
  const [tryUrl, setTryUrl] = useState<string | null>(null);
  const [tryLoading, setTryLoading] = useState(false);
  const [visited] = useState(hasVisit);
  const [isPublishing, startPublishing] = useTransition();
  // What the current page looked like when it was last loaded or saved, to tell whether there are unsaved changes.
  const snapshot = (list: BuilderBlock[]) =>
    JSON.stringify(list.map((b) => [b.type, b.config, b.minTier]));
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    snapshot(initialBlocks.map(toBuilderBlock)),
  );
  const dirty = snapshot(blocks) !== savedSnapshot;
  // Changes save on their own, a moment after the last edit: a "Save" button next to "Publish" made people wonder
  // whether they had to press it first, and whether closing the tab would lose their work. The toolbar says where
  // things stand ("Saving…", "All changes saved", or an error with a retry).
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  // The latest blocks and page, for handlers that run after a render (saving, switching pages, undo).
  const blocksRef = useRef(blocks);
  const pageIdRef = useRef(currentPageId);
  useEffect(() => {
    blocksRef.current = blocks;
    pageIdRef.current = currentPageId;
  }, [blocks, currentPageId]);
  const inFlight = useRef<Promise<boolean> | null>(null);

  // Ask AI (⌘K): one bar, two scopes. "This section" rewrites the selected section's words; "Whole site" hands the
  // request to the agent. What comes back lands on the page as pending changes, each with Keep / Undo, so the owner
  // reviews the result where it shows rather than in a chat.
  const [ask, setAsk] = useState<{ open: boolean; scope: AskScope }>({ open: false, scope: "site" });
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingChange[]>([]);
  const [busySuggestion, setBusySuggestion] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const changeSeq = useRef(0);
  const nextChangeId = (prefix: string) => `${prefix}:${++changeSeq.current}`;

  // The AI chat (outside this component) works on the saved app, so it needs to know when there are unsaved edits.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("builder-dirty", { detail: { dirty } }),
    );
  }, [dirty]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null;
  useEffect(() => {
    selectedRef.current = selectedBlockId;
  }, [selectedBlockId]);

  // "Next up": what is still the template's, and news the banner isn't telling. Recomputed as the page changes.
  const suggestions = useMemo(() => {
    const all = suggestNext({ appId: currentApp.id, appName: currentApp.name, blocks: blocks.map((b) => ({ id: b.id, type: b.type, config: b.config as Record<string, unknown> })), events: recentEvents });
    return ASK_AI_VISIBLE ? all : withoutAi(all);
  }, [blocks, recentEvents, currentApp.id, currentApp.name]);

  /** Adds a section at `index` (between two sections, from the + bar) or at the end (from the side list). */
  function addBlock(type: BlockType, index?: number) {
    const block = {
      id: crypto.randomUUID(),
      type,
      config: defaultConfigFor(type),
      minTier: null,
    } as BuilderBlock;
    editBlocks((prev) => (index === undefined ? [...prev, block] : [...prev.slice(0, index), block, ...prev.slice(index)]));
    setSelectedBlockId(block.id);
  }

  // Clicking words on the page lights up their box in the inspector (which may still be opening: a few tries).
  useEffect(() => {
    const onFocus = (e: Event) => {
      const { key, source } = (e as CustomEvent<FieldFocusDetail>).detail;
      if (source !== "page") return;
      let tries = 0;
      const find = () => {
        const el = inspectorRef.current?.querySelector<HTMLElement>(`[data-field="${CSS.escape(key)}"]`);
        if (el) flashField(el);
        else if (tries++ < 10) window.setTimeout(find, 60);
      };
      find();
    };
    window.addEventListener(FIELD_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(FIELD_FOCUS_EVENT, onFocus);
  }, []);

  // Undo and redo: every edit to the page's sections goes through `editBlocks`, which remembers the state before it.
  // Loading a page (switching, creating) starts a fresh history. Typing into one field within a second counts as one edit.
  const past = useRef<BuilderBlock[][]>([]);
  const future = useRef<BuilderBlock[][]>([]);
  const lastEditKey = useRef<string | null>(null);
  // How much there is to undo and redo, as state so the buttons can show it (refs aren't read while rendering).
  const [history, setHistory] = useState({ past: 0, future: 0 });
  const syncHistory = () => setHistory({ past: past.current.length, future: future.current.length });

  function editBlocks(updater: (prev: BuilderBlock[]) => BuilderBlock[], coalesceKey?: string) {
    const prev = blocksRef.current;
    const next = updater(prev);
    if (next === prev) return;
    // Edits to the same field in a row (typing) are one step; anything else starts a new one.
    const merge = coalesceKey !== undefined && lastEditKey.current === coalesceKey;
    if (!merge) {
      past.current.push(prev);
      if (past.current.length > 60) past.current.shift();
    }
    lastEditKey.current = coalesceKey ?? null;
    future.current = [];
    setBlocks(next);
    syncHistory();
  }

  function resetHistory() {
    past.current = [];
    future.current = [];
    lastEditKey.current = null;
    syncHistory();
  }

  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(blocksRef.current);
    lastEditKey.current = null;
    setBlocks(prev);
    // Stepping through history by hand takes over from the AI's Keep / Undo pairs on this page.
    setPending((list) => list.filter((p) => p.kind !== "changed" && p.kind !== "added" && p.kind !== "removed"));
    if (selectedBlockId && !prev.some((b) => b.id === selectedBlockId)) setSelectedBlockId(null);
    syncHistory();
  }

  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(blocksRef.current);
    lastEditKey.current = null;
    setBlocks(next);
    setPending((list) => list.filter((p) => p.kind !== "changed" && p.kind !== "added" && p.kind !== "removed"));
    syncHistory();
  }

  // Cmd/Ctrl+Z undoes, Shift adds redo (Ctrl+Y too), unless the keystroke is inside a field, where the browser undoes typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, select") || target.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undo/redo read refs; the handler needs no re-binding
  }, []);

  // ⌘K opens Ask AI, even from inside a text field: that is where the owner is when they want help with the words.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ASK_AI_VISIBLE || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setAsk((prev) => (prev.open ? { open: false, scope: prev.scope } : { open: true, scope: selectedRef.current ? "section" : "site" }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function updateBlockConfig(id: string, config: BlockConfig) {
    editBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, config } as BuilderBlock) : b)), `config:${id}`);
  }

  function moveBlock(id: string, direction: -1 | 1) {
    editBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      const to = index + direction;
      if (index === -1 || to < 0 || to >= prev.length) return prev;
      return arrayMove(prev, index, to);
    });
  }

  function duplicateBlock(id: string) {
    const copyId = crypto.randomUUID();
    editBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index === -1) return prev;
      const copy = { ...prev[index], id: copyId, config: structuredClone(prev[index].config) } as BuilderBlock;
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
    setSelectedBlockId(copyId);
  }

  function updateSelectedBlockConfig(config: BlockConfig) {
    if (!selectedBlockId) return;
    updateBlockConfig(selectedBlockId, config);
  }

  function updateSelectedBlockMinTier(minTier: string | null) {
    if (!selectedBlockId) return;
    editBlocks((prev) => prev.map((b) => (b.id === selectedBlockId ? { ...b, minTier } : b)));
  }

  function removeBlock(id: string) {
    const index = blocks.findIndex((b) => b.id === id);
    const removed = blocks[index];
    editBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
    if (!removed) return;
    // One click removes a whole section, and it saves on its own: so the toast offers to put it back.
    toast(`${BLOCK_TYPE_LABELS[removed.type]} section removed`, {
      action: { label: "Undo", onClick: () => editBlocks((prev) => (prev.some((b) => b.id === id) ? prev : [...prev.slice(0, index), removed, ...prev.slice(index)])) },
      duration: 8000,
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    editBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function switchPage(pageId: string) {
    // Whatever was being edited on this page is kept before the other page loads.
    if (snapshot(blocksRef.current) !== savedSnapshot && !(await saveBlocks()))
      return;
    setCurrentPageId(pageId);
    setSelectedBlockId(null);
    const { data, error } = await supabase
      .from("blocks")
      .select("*")
      .eq("page_id", pageId)
      .order("position", { ascending: true });

    if (error) {
      toast.error("Failed to load page: " + error.message);
      return;
    }
    const loaded = (data ?? []).map(toBuilderBlock);
    setBlocks(loaded);
    setSavedSnapshot(snapshot(loaded));
    resetHistory();
  }

  async function createPage(name: string, path: string) {
    const res = await fetch(`/api/apps/${currentApp.id}/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, path }),
    });
    const body = await res.json();
    if (!res.ok) {
      toast.error(body.error ?? "Failed to create page");
      return;
    }
    const newPage: PageRow = body.page;
    setPages((prev) => [...prev, newPage]);
    setCurrentPageId(newPage.id);
    setBlocks([]);
    setSavedSnapshot(snapshot([]));
    setSelectedBlockId(null);
    resetHistory();
  }

  /** The app's theme, saved whole (the app's PATCH replaces `theme` as one value). */
  async function saveTheme(theme: ThemeConfig): Promise<boolean> {
    const res = await fetch(`/api/apps/${currentApp.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme }) });
    const body = await res.json();
    if (!res.ok) {
      toast.error(body.error ?? "Couldn't save");
      return false;
    }
    setCurrentApp(body.app);
    return true;
  }

  /** What the tabs above the page can do to a page. */
  const pageActions: PageActions = {
    inMenu: (page) => (currentApp.theme.bottom_nav ?? []).some((item) => item.page_path === page.path),
    setInMenu: async (page, show) => {
      const nav = currentApp.theme.bottom_nav ?? [];
      const next = show ? [...nav, { label: page.name.slice(0, 14), icon: page.is_home ? "home" : "info", page_path: page.path }] : nav.filter((item) => item.page_path !== page.path);
      if (await saveTheme({ ...currentApp.theme, bottom_nav: next })) toast.success(show ? `${page.name} is in the menu` : `${page.name} is out of the menu (still reachable by its address)`);
    },
    updateSeo: async (pageId, seo) => {
      const res = await fetch(`/api/apps/${currentApp.id}/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seo_title: seo.seo_title.trim() || null,
          seo_description: seo.seo_description.trim() || null,
          share_image_url: seo.share_image_url.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't save those settings");
        return;
      }
      setPages((prev) => prev.map((p) => (p.id === pageId ? body.page : p)));
      toast.success("Saved");
    },
    rename: async (pageId, name) => {
      const res = await fetch(`/api/apps/${currentApp.id}/pages/${pageId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't rename the page");
        return;
      }
      setPages((prev) => prev.map((p) => (p.id === pageId ? body.page : p)));
      // The menu's tab keeps up with the page's name.
      const page = pages.find((p) => p.id === pageId);
      const nav = currentApp.theme.bottom_nav ?? [];
      if (page && nav.some((item) => item.page_path === page.path && item.label === page.name)) {
        await saveTheme({ ...currentApp.theme, bottom_nav: nav.map((item) => (item.page_path === page.path ? { ...item, label: name.slice(0, 14) } : item)) });
      }
    },
    move: async (pageId, direction) => {
      const index = pages.findIndex((p) => p.id === pageId);
      const to = index + direction;
      if (index === -1 || to < 0 || to >= pages.length) return;
      const res = await fetch(`/api/apps/${currentApp.id}/pages/${pageId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: to }) });
      if (!res.ok) {
        toast.error("Couldn't move the page");
        return;
      }
      setPages((prev) => arrayMove(prev, index, to));
    },
    duplicate: async (pageId) => {
      const source = pages.find((p) => p.id === pageId);
      if (!source) return;
      // The source's sections: the ones on screen if it is the open page, otherwise loaded.
      let sourceBlocks = pageId === currentPageId ? blocksRef.current : [];
      if (pageId !== currentPageId) {
        const { data } = await supabase.from("blocks").select("*").eq("page_id", pageId).order("position", { ascending: true });
        sourceBlocks = (data ?? []).map(toBuilderBlock);
      }
      const name = `${source.name} copy`;
      let created: PageRow | null = null;
      for (const suffix of ["-copy", "-copy-2", "-copy-3"]) {
        const res = await fetch(`/api/apps/${currentApp.id}/pages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, path: `${slugify(source.path)}${suffix}` }) });
        const body = await res.json();
        if (res.ok) {
          created = body.page;
          break;
        }
        if (!/already exists/.test(body.error ?? "")) {
          toast.error(body.error ?? "Couldn't duplicate the page");
          return;
        }
      }
      if (!created) {
        toast.error("Couldn't find a free address for the copy");
        return;
      }
      const put = await fetch(`/api/apps/${currentApp.id}/pages/${created.id}/blocks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: sourceBlocks.map((b, position) => ({ type: b.type, position, config: b.config, min_tier: b.minTier })) }),
      });
      if (!put.ok) toast.error("The page was made but its sections didn't copy");
      setPages((prev) => [...prev, created]);
      toast.success(`${name} added. It is not in the menu yet.`);
      await switchPage(created.id);
    },
    remove: async (pageId) => {
      const page = pages.find((p) => p.id === pageId);
      if (!page) return;
      if (!window.confirm(`Delete the ${page.name} page and everything on it? This can't be undone.`)) return;
      const res = await fetch(`/api/apps/${currentApp.id}/pages/${pageId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error ?? "Couldn't delete the page");
        return;
      }
      const remaining = pages.filter((p) => p.id !== pageId);
      setPages(remaining);
      const nav = currentApp.theme.bottom_nav ?? [];
      if (nav.some((item) => item.page_path === page.path)) await saveTheme({ ...currentApp.theme, bottom_nav: nav.filter((item) => item.page_path !== page.path) });
      if (pageId === currentPageId) {
        const home = remaining.find((p) => p.is_home) ?? remaining[0];
        if (home) await switchPage(home.id);
      }
      toast.success(`${page.name} deleted`);
    },
  };

  /** Persists the current page's blocks as they are right now. Returns whether it succeeded so `togglePublish` can
   * bail out instead of publishing a stale page. One request at a time: a call made while one is running waits for
   * it, then sends the latest state. The local blocks are kept as they are (the server gives every block a new id on
   * each save, and swapping them in mid-edit would drop the selection and the cursor); the ids only need to agree
   * again on the next full load. */
  function saveBlocks(): Promise<boolean> {
    const run = async (): Promise<boolean> => {
      if (inFlight.current) await inFlight.current;
      const list = blocksRef.current;
      const sent = snapshot(list);
      const pageId = pageIdRef.current;
      setSaveStatus("saving");
      try {
        const res = await fetch(
          `/api/apps/${currentApp.id}/pages/${pageId}/blocks`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blocks: list.map((b, index) => ({
                type: b.type,
                config: b.config,
                min_tier: b.minTier,
                position: index,
              })),
            }),
          },
        );
        const body = await res.json();
        if (!res.ok) {
          setSaveStatus("error");
          toast.error(body.error ?? "Couldn't save your changes");
          return false;
        }
      } catch {
        setSaveStatus("error");
        toast.error("Couldn't save your changes. Check your connection.");
        return false;
      }
      setSavedSnapshot(sent);
      setSaveStatus("saved");
      return true;
    };
    const p = run().finally(() => {
      if (inFlight.current === p) inFlight.current = null;
    });
    inFlight.current = p;
    return p;
  }

  // Autosave: a moment after the last edit. Every edit re-arms the timer, so typing is one save at the end, not one
  // per keystroke. A failed save waits for the next edit (or the toolbar's Retry) rather than hammering the server.
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => void saveBlocks(), 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-armed on each edit (blocks); saveBlocks reads refs
  }, [dirty, blocks]);
  // What the toolbar says: a request in flight or a failure first, otherwise whether anything is still unsaved.
  const saveState: "saved" | "saving" | "unsaved" | "error" =
    saveStatus !== "saved" ? saveStatus : dirty ? "unsaved" : "saved";

  // Closing the tab in the second or two before a save lands would lose the edit; the browser asks first.
  useEffect(() => {
    if (saveState === "saved") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  function togglePublish() {
    if (currentApp.status === "published" && !window.confirm(`Take ${liveHost} offline? Visitors will get a "not found" page until you publish again. Your work is kept.`)) return;
    const nextStatus =
      currentApp.status === "published" ? "draft" : "published";
    startPublishing(async () => {
      // Publishing saves the canvas first — otherwise "Publish" only flips
      // the status and a creator who never clicked Save ships an empty
      // page (exactly what happened the first time this was used).
      if (nextStatus === "published" && !(await saveBlocks())) return;

      // Whatever goes wrong (offline, a server error page instead of JSON), the owner gets a sentence and keeps the
      // builder; an error thrown here used to unmount the whole page.
      let res: Response;
      try {
        res = await fetch(`/api/apps/${currentApp.id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
      } catch {
        toast.error(NETWORK_ERROR);
        return;
      }
      const body: { error?: string; app?: AppRow } | null = await res.json().catch(() => null);
      if (!res.ok || !body?.app) {
        toast.error(typeof body?.error === "string" && body.error.trim() && res.status < 500 ? body.error : SERVER_ERROR);
        return;
      }
      setCurrentApp(body.app);
      toast.success(
        nextStatus === "published" ? "Your app is live" : "App unpublished",
      );
    });
  }

  async function tryIt() {
    setMode("try");
    setTryLoading(true);
    setTryUrl(null);
    if (
      snapshot(blocksRef.current) !== savedSnapshot &&
      !(await saveBlocks())
    ) {
      setMode("edit");
      setTryLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/apps/${currentApp.id}/preview`, {
        method: "POST",
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url)
        throw new Error(body.error ?? "Couldn't open the preview");
      setTryUrl(body.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the preview");
      setMode("edit");
    } finally {
      setTryLoading(false);
    }
  }

  function openAsk(scope: AskScope) {
    setAsk({ open: true, scope });
  }

  /** Cmd+K on one section: its words come back changed; the change sits on the section with Keep / Undo. */
  async function askSection(blockId: string, instruction: string): Promise<boolean> {
    const block = blocksRef.current.find((b) => b.id === blockId);
    if (!block) return false;
    setAiBusy("Rewriting…");
    try {
      const res = await fetch(`/api/apps/${currentApp.id}/ai/section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: block.type, config: block.config, instruction }),
      });
      const body = (await res.json()) as { config?: BlockConfig; error?: string };
      if (!res.ok || !body.config) {
        toast.error(body.error ?? "Couldn't change it");
        return false;
      }
      const config = body.config;
      editBlocks((prev) => prev.map((b) => (b.id === blockId ? ({ ...b, config } as BuilderBlock) : b)));
      setPending((prev) => [...prev.filter((p) => !("blockId" in p && p.blockId === blockId)), { id: nextChangeId(`changed:${blockId}`), kind: "changed", blockId, before: block, label: `${BLOCK_TYPE_LABELS[block.type]} rewritten` }]);
      return true;
    } catch {
      toast.error("Couldn't reach the AI. Check your connection.");
      return false;
    } finally {
      setAiBusy(null);
    }
  }

  async function putBlocks(pageId: string, list: DraftBlock[]): Promise<boolean> {
    const res = await fetch(`/api/apps/${currentApp.id}/pages/${pageId}/blocks`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks: list.map((b, position) => ({ type: b.type, position, config: b.config, min_tier: b.min_tier })) }),
    });
    return res.ok;
  }

  async function createPageQuietly(name: string, path: string): Promise<PageRow | null> {
    const res = await fetch(`/api/apps/${currentApp.id}/pages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, path }) });
    const body = await res.json();
    if (!res.ok) {
      toast.error(body.error ?? `Couldn't add the ${name} page`);
      return null;
    }
    setPages((prev) => [...prev, body.page as PageRow]);
    return body.page as PageRow;
  }

  /**
   * The agent: one request about the whole site. The open page's changes land as pending sections (Keep / Undo on
   * each); other pages, new pages and the menu go through the builder's own APIs and get an Undo in the bar above
   * the page. Earlier pending changes count as kept.
   */
  async function askSite(instruction: string): Promise<boolean> {
    setAiBusy("Working on it…");
    try {
      if (snapshot(blocksRef.current) !== savedSnapshot && !(await saveBlocks())) return false;
      const res = await fetch(`/api/apps/${currentApp.id}/ai/agent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction }) });
      const body = (await res.json()) as { reply?: string; before?: Draft; after?: Draft; applied?: number; skipped?: string[]; error?: string };
      if (!res.ok || !body.before || !body.after) {
        toast.error(body.error ?? "Couldn't make that change");
        return false;
      }
      if (!body.applied) {
        toast(body.reply || "Nothing to change.");
        return true;
      }
      const next: PendingChange[] = [];
      const afterPage = body.after.pages.find((p) => p.id === pageIdRef.current);
      if (afterPage) {
        const plan = planCurrentPage(blocksRef.current, afterPage.blocks, (t) => BLOCK_TYPE_LABELS[t as BlockType], () => crypto.randomUUID());
        if (plan.pending.length) {
          editBlocks(() => plan.blocks as BuilderBlock[]);
          next.push(...plan.pending);
        }
      }
      const site = planSite(body.before, body.after, pageIdRef.current);
      for (const { page, before } of site.changedPages) {
        if (page.id && (await putBlocks(page.id, page.blocks))) next.push({ id: `page:${page.id}`, kind: "page", pageId: page.id, name: page.name, beforeBlocks: before, label: `${page.name} page changed` });
      }
      for (const page of site.newPages) {
        const created = await createPageQuietly(page.name, page.path);
        if (created) {
          await putBlocks(created.id, page.blocks);
          next.push({ id: `new-page:${created.id}`, kind: "new-page", pageId: created.id, name: page.name, label: `${page.name} page added` });
        }
      }
      for (const page of site.removedPages) {
        const del = await fetch(`/api/apps/${currentApp.id}/pages/${page.id}`, { method: "DELETE" });
        if (del.ok) {
          setPages((prev) => prev.filter((p) => p.id !== page.id));
          next.push({ id: `removed-page:${page.id}`, kind: "removed-page", page, label: `${page.name} page removed` });
        }
      }
      if (site.theme && (await saveTheme(site.theme.after))) next.push({ id: nextChangeId("theme"), kind: "theme", before: site.theme.before, label: "Menu or colours changed" });
      setPending(next);
      if (body.reply) toast.success(body.reply);
      if (body.skipped?.length) console.warn("agent skipped:", body.skipped);
      return true;
    } catch {
      toast.error("Couldn't reach the AI. Check your connection.");
      return false;
    } finally {
      setAiBusy(null);
    }
  }

  function keepChange(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  async function undoChange(change: PendingChange) {
    switch (change.kind) {
      case "changed":
        editBlocks((prev) => prev.map((b) => (b.id === change.blockId ? (change.before as BuilderBlock) : b)));
        break;
      case "added":
        editBlocks((prev) => prev.filter((b) => b.id !== change.blockId));
        setSelectedBlockId((current) => (current === change.blockId ? null : current));
        break;
      case "removed":
        editBlocks((prev) => [...prev.slice(0, change.index), change.before as BuilderBlock, ...prev.slice(change.index)]);
        break;
      case "page":
        if (!(await putBlocks(change.pageId, change.beforeBlocks))) toast.error(`Couldn't put the ${change.name} page back`);
        break;
      case "new-page": {
        const res = await fetch(`/api/apps/${currentApp.id}/pages/${change.pageId}`, { method: "DELETE" });
        if (res.ok) setPages((prev) => prev.filter((p) => p.id !== change.pageId));
        else toast.error(`Couldn't remove the ${change.name} page`);
        break;
      }
      case "removed-page": {
        const created = await createPageQuietly(change.page.name, change.page.path);
        if (created) await putBlocks(created.id, change.page.blocks);
        break;
      }
      case "theme":
        await saveTheme(change.before);
        break;
    }
    setPending((prev) => prev.filter((p) => p.id !== change.id));
  }

  async function undoAll() {
    for (const change of [...pending].reverse()) await undoChange(change);
  }

  async function runSuggestion(s: Suggestion) {
    if (s.action.kind === "link") {
      window.open(s.action.href, "_blank", "noopener");
      return;
    }
    if (s.action.kind === "open" && s.blockId) {
      setSelectedBlockId(s.blockId);
      document.querySelector(`[data-block-id="${CSS.escape(s.blockId)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (s.action.kind === "ai" && s.blockId) {
      setBusySuggestion(s.id);
      try {
        await askSection(s.blockId, s.action.instruction);
      } finally {
        setBusySuggestion(null);
      }
    }
  }

  /** The Keep / Undo pair for a section the AI just changed, if there is one. */
  function pendingPropsFor(blockId: string) {
    const p = pending.find((c) => (c.kind === "changed" || c.kind === "added") && c.blockId === blockId);
    return p ? { label: p.label, onKeep: () => keepChange(p.id), onUndo: () => void undoChange(p) } : undefined;
  }
  const pendingElsewhere = pending.filter((p) => p.kind !== "changed" && p.kind !== "added");

  const currentPage = pages.find((p) => p.id === currentPageId);
  const currentPagePath = currentPage?.path;
  const live = currentApp.status === "published";
  // Protocol-relative, like the other links to the published app, so it also works on localhost.
  // The app's own domain once it is connected; otherwise its address under TapAndLaunch.
  const liveUrl = !live ? null : currentApp.custom_domain && currentApp.custom_domain_status === "verified" ? `https://${currentApp.custom_domain}` : `//${currentApp.slug}.${rootDomain}`;
  const liveHost = currentApp.custom_domain && currentApp.custom_domain_status === "verified" ? currentApp.custom_domain : `${currentApp.slug}.${rootDomain}`;
  const checklist = buildChecklist({
    hasContent: blocks.length > 0 || contentOnOtherPages,
    hasIcon: !!currentApp.manifest.icon_url,
    hasLook: !!currentApp.theme.looks_confirmed,
    published: live,
    hasVisit: visited,
  });

  function runChecklistStep(step: ChecklistStepId) {
    if (step === "content") {
      const search = document.getElementById("block-search");
      search?.scrollIntoView({ block: "center" });
      search?.focus();
    } else if (step === "look") {
      window.dispatchEvent(
        new CustomEvent("open-app-settings", { detail: { tab: "theme" } }),
      );
    } else if (step === "publish") {
      togglePublish();
    } else if (step === "visit") {
      // The app's page has the QR code; the step ticks itself once someone actually opens the app.
      window.open(`/dashboard/apps/${currentApp.id}`, "_blank", "noopener");
    }
  }

  return (
    <>
      <BuilderPhoneNotice
        name={currentApp.name}
        live={live}
        liveUrl={liveUrl}
      />
      <div className="dark hidden h-[calc(100dvh-3.5rem)] flex-col bg-neutral-950 text-neutral-50 lg:flex">
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/dashboard"
              aria-label="All apps"
              title="All apps"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-neutral-100 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <AppMark app={currentApp} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[15px] font-semibold tracking-tight">
                  {currentApp.name}
                </h1>
                <span
                  title={live ? "Your app is live" : `Not live yet. Press Publish to go live at ${liveHost}`}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                    live
                      ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
                      : "bg-white/5 text-neutral-200 ring-1 ring-inset ring-white/10"
                  }`}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {live && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-400" : "bg-neutral-500"}`}
                    />
                  </span>
                  {live ? "Live" : "Draft"}
                </span>
              </div>
              {/* A live app's address is a link. A draft's goes nowhere yet, so it is only in the Draft badge's hint. */}
              {live && (
                <a
                  href={liveUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden items-center gap-1 truncate text-sm text-neutral-100 transition hover:text-white sm:inline-flex"
                >
                  {liveHost}{" "}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div role="group" aria-label="Undo and redo" className="inline-flex items-center gap-0.5">
              <button type="button" onClick={undo} disabled={history.past === 0} aria-label="Undo" title="Undo (⌘Z)" className="grid h-8 w-8 place-items-center rounded-full text-neutral-100 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent">
                <Undo2 className="h-4 w-4" />
              </button>
              <button type="button" onClick={redo} disabled={history.future === 0} aria-label="Redo" title="Redo (⇧⌘Z)" className="grid h-8 w-8 place-items-center rounded-full text-neutral-100 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent">
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
            {/* Where the work stands. Changes save on their own, so when all is well this is only a small tick;
                words appear only when something is happening or has gone wrong. */}
            <p
              role="status"
              className="hidden items-center gap-1.5 text-sm text-neutral-200 md:inline-flex"
            >
              {saveState === "saving" && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              )}
              {saveState === "saved" && (
                <span title={live ? "Live · all changes saved" : "All changes saved"} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="sr-only">{live ? "Live · all changes saved" : "All changes saved"}</span>
                </span>
              )}
              {saveState === "unsaved" && "Unsaved changes…"}
              {saveState === "error" && (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />{" "}
                  Couldn&apos;t save.
                  <button
                    type="button"
                    onClick={() => void saveBlocks()}
                    className="font-semibold text-white underline underline-offset-2"
                  >
                    Try again
                  </button>
                </>
              )}
            </p>
            <div
              role="group"
              aria-label="Edit or try the app"
              className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-sm font-semibold"
            >
              <button
                type="button"
                aria-pressed={mode === "edit"}
                onClick={() => setMode("edit")}
                className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm transition ${mode === "edit" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-200 hover:text-white"}`}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                type="button"
                aria-pressed={mode === "try"}
                onClick={() => void tryIt()}
                title="Your real app, as a visitor sees it"
                className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm transition ${mode === "try" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-200 hover:text-white"}`}
              >
                <Play className="h-3.5 w-3.5" /> Try it
              </button>
            </div>
            <DeviceFrameSwitcher value={device} onChange={setDevice} />
            <AppSettingsDialog
              app={currentApp}
              pages={pages}
              onSaved={setCurrentApp}
              domainsEnabled={domainsEnabled}
              rootDomain={rootDomain}
            />
            <span className="mx-1 h-6 w-px bg-white/10" aria-hidden />
            {live ? (
              <button
                type="button"
                onClick={togglePublish}
                disabled={isPublishing}
                className="inline-flex h-9 items-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-neutral-100 transition hover:bg-white/10 disabled:opacity-50"
              >
                {isPublishing ? "Unpublishing…" : "Unpublish"}
              </button>
            ) : (
              <button
                type="button"
                onClick={togglePublish}
                disabled={isPublishing}
                className={PRIMARY}
              >
                <Rocket className="h-4 w-4" />{" "}
                {isPublishing ? "Publishing…" : "Publish"}
              </button>
            )}
          </div>
        </header>

        <PageTabs
          pages={pages}
          currentPageId={currentPageId}
          organizationId={currentApp.organization_id}
          onSelect={switchPage}
          onCreate={createPage}
          actions={pageActions}
        />

        {/* Two columns: the page, and the panel for photos and settings. Sections are added on the page itself (the
            + bars between them), so there is no list of sections down the side any more. */}
        <div className="grid flex-1 grid-cols-[1fr_320px] overflow-hidden">
          <div className="relative flex flex-col overflow-hidden">
          {/* Changes the AI made beyond this page's sections: other pages, new pages, the menu. Each has its own Undo. */}
          {pendingElsewhere.length > 0 && (
            <div className="z-10 flex flex-wrap items-center gap-2 border-b border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2 text-sm text-neutral-100">
              <Sparkles className="h-4 w-4 text-fuchsia-300" />
              {pendingElsewhere.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-neutral-950/60 py-0.5 pl-2.5 pr-1 ring-1 ring-white/10">
                  {p.label}
                  <button type="button" onClick={() => void undoChange(p)} className="rounded-full px-2 py-0.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/10 hover:text-white">
                    Undo
                  </button>
                </span>
              ))}
              <span className="ml-auto inline-flex gap-1">
                <button type="button" onClick={() => setPending((prev) => prev.filter((p) => p.kind === "changed" || p.kind === "added"))} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-950 transition hover:bg-emerald-50">
                  Keep these
                </button>
                <button type="button" onClick={() => void undoAll()} className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-200 transition hover:bg-white/10 hover:text-white">
                  Undo all
                </button>
              </span>
            </div>
          )}
          <div className="relative flex-1 overflow-y-auto px-6 pb-14 pt-6">
            {/* Workspace backdrop: the dashboard hero's two glows and dot texture. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-indigo-600/20 blur-3xl" />
              <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-pink-500/15 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]" />
            </div>
            {mode === "try" ? (
              <PreviewFrame device={device} theme={currentApp.theme}>
                {tryUrl ? (
                  <iframe
                    src={tryUrl}
                    title={`${currentApp.name}, as a visitor sees it`}
                    allow="geolocation"
                    className="h-full w-full flex-1 border-0 bg-background"
                  />
                ) : (
                  <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
                    {tryLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Opening
                        your app…
                      </span>
                    ) : (
                      "Couldn't open the preview."
                    )}
                  </div>
                )}
              </PreviewFrame>
            ) : (
              <PreviewFrame device={device} theme={currentApp.theme}>
                <AnnouncementBar theme={currentApp.theme} preview />
                {/* A website's desktop preview gets the site header with its page menu; everything else the app header. */}
                {device === "desktop" && currentApp.theme.layout === "website" ? (
                  <SiteHeader
                    theme={currentApp.theme}
                    activePagePath={currentPagePath}
                    onNavigate={(pagePath) => {
                      const target = pages.find((p) => p.path === pagePath);
                      if (target) switchPage(target.id);
                    }}
                  />
                ) : (
                  <AppHeader theme={currentApp.theme} />
                )}
                <div className="@container flex-1 overflow-y-auto">
                  <DndContext
                    id="builder-blocks"
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={blocks.map((b) => b.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {blocks.length === 0 ? (
                        <div className="m-4 rounded-2xl border border-dashed border-border p-6 text-center">
                          <p className="text-sm font-medium">This page is empty</p>
                          <p className="mb-2 mt-1 text-xs text-muted-foreground">Add your first section.</p>
                          <AddSectionBar always label="Add a section" mapsEnabled={mapsEnabled} onAdd={(type) => addBlock(type, 0)} />
                        </div>
                      ) : (
                        <>
                          {blocks.map((block, index) => (
                            <div key={block.id}>
                              <AddSectionBar mapsEnabled={mapsEnabled} onAdd={(type) => addBlock(type, index)} />
                              <SortableBlockItem
                                block={block}
                                selected={block.id === selectedBlockId}
                                onSelect={() => setSelectedBlockId(block.id)}
                                onRemove={() => removeBlock(block.id)}
                                onMoveUp={index > 0 ? () => moveBlock(block.id, -1) : undefined}
                                onMoveDown={index < blocks.length - 1 ? () => moveBlock(block.id, 1) : undefined}
                                onDuplicate={() => duplicateBlock(block.id)}
                                onChange={(config) => updateBlockConfig(block.id, config)}
                                organizationId={currentApp.organization_id}
                                onAsk={
                                  ASK_AI_VISIBLE
                                    ? () => {
                                        setSelectedBlockId(block.id);
                                        openAsk("section");
                                      }
                                    : undefined
                                }
                                pending={pendingPropsFor(block.id)}
                              />
                            </div>
                          ))}
                          <AddSectionBar always mapsEnabled={mapsEnabled} onAdd={(type) => addBlock(type, blocks.length)} />
                        </>
                      )}
                      <SiteFooter theme={currentApp.theme} />
                    </SortableContext>
                  </DndContext>
                </div>
                {/* Non-navigating preview: clicking a tab switches the builder's
                current page (if one matches its path) the same way clicking
                a page tab does, rather than performing a real navigation. */}
                {!(device === "desktop" && currentApp.theme.layout === "website") && (
                  <BottomNav
                    items={currentApp.theme.bottom_nav ?? []}
                    activePagePath={currentPagePath}
                    onNavigate={(pagePath) => {
                      const target = pages.find((p) => p.path === pagePath);
                      if (target) switchPage(target.id);
                    }}
                  />
                )}
              </PreviewFrame>
            )}
          </div>
          {ASK_AI_VISIBLE && (
            <AskAiBar
              open={ask.open}
              scope={ask.scope}
              sectionLabel={selectedBlock ? BLOCK_TYPE_LABELS[selectedBlock.type] : null}
              busy={aiBusy}
              onScope={(scope) => setAsk({ open: true, scope })}
              onClose={() => setAsk((prev) => ({ ...prev, open: false }))}
              onSubmit={(instruction, scope) => (scope === "section" && selectedBlockId ? askSection(selectedBlockId, instruction) : askSite(instruction))}
            />
          )}
          </div>

          <aside ref={inspectorRef} className="overflow-y-auto border-l border-white/[0.06] bg-neutral-950">
            <Inspector
              block={selectedBlock}
              pageName={currentPage?.name ?? "This page"}
              blocks={blocks}
              onSelect={setSelectedBlockId}
              onClose={() => setSelectedBlockId(null)}
              checklist={checklist}
              publishing={isPublishing}
              onChecklistAction={runChecklistStep}
              appId={currentApp.id}
              organizationId={currentApp.organization_id}
              onChange={updateSelectedBlockConfig}
              onMinTierChange={updateSelectedBlockMinTier}
              pages={pages.map((p) => ({ path: p.path, name: p.name }))}
              suggestions={suggestions}
              busySuggestion={busySuggestion}
              onSuggestion={(s) => void runSuggestion(s)}
            />
          </aside>
        </div>
      </div>
    </>
  );
}

const PRIMARY =
  "inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-neutral-950 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_8px_24px_-8px_rgba(129,140,248,0.8)] transition hover:bg-indigo-50 disabled:opacity-60";

/** The app's icon, or its letter tile in the app's own colour. */
function AppMark({ app }: { app: AppRow }) {
  const tile = tileGradient(app.id);
  const brand = app.theme.primary_color;
  if (app.manifest.icon_url) {
    /* eslint-disable @next/next/no-img-element -- tenant-provided storage URL */
    return (
      <img
        src={app.manifest.icon_url}
        alt=""
        className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-md"
      />
    );
  }
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-md ${brand ? "" : tile.classes}`}
      style={
        brand
          ? {
              background: `linear-gradient(135deg, ${brand} 0%, color-mix(in oklab, ${brand} 45%, #0a0a0a) 100%)`,
            }
          : undefined
      }
    >
      {tileInitial(app.name)}
    </span>
  );
}

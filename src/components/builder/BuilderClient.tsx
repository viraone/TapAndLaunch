"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Rocket, Save } from "lucide-react";
import { tileGradient, tileInitial } from "@/lib/apps/tile";
import { buildChecklist, type ChecklistStepId } from "@/lib/apps/checklist";
import { BuilderPhoneNotice } from "@/components/builder/BuilderPhoneNotice";
import { Palette } from "@/components/builder/Palette";
import { Inspector } from "@/components/builder/Inspector";
import { PageTabs } from "@/components/builder/PageTabs";
import { SortableBlockItem } from "@/components/builder/SortableBlockItem";
import { MobilePreviewFrame, DeviceFrameSwitcher, type DeviceFrame } from "@/components/builder/MobilePreviewFrame";
import { AppSettingsDialog } from "@/components/builder/AppSettingsDialog";
import { BottomNav } from "@/components/pwa-runtime/BottomNav";
import { AppHeader } from "@/components/pwa-runtime/AppHeader";
import { createClient } from "@/lib/supabase/client";
import { defaultConfigFor } from "@/lib/builder/block-defaults";
import type { BuilderBlock } from "@/components/builder/types";
import type { BlockConfig, BlockType, Database } from "@/types/database";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];
type PageRow = Database["public"]["Tables"]["pages"]["Row"];
type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];

function toBuilderBlock(row: BlockRow): BuilderBlock {
  // Safe by construction: `type` narrows `config` at the DB layer via the
  // same union this file uses, just not provably to TypeScript across the
  // jsonb boundary.
  return { id: row.id, type: row.type, config: row.config, minTier: row.min_tier } as BuilderBlock;
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
}) {
  const supabase = createClient();

  const [currentApp, setCurrentApp] = useState(app);
  const [pages, setPages] = useState(initialPages);
  const [currentPageId, setCurrentPageId] = useState(initialPageId);
  const [blocks, setBlocks] = useState<BuilderBlock[]>(initialBlocks.map(toBuilderBlock));
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceFrame>("ios");
  const [visited] = useState(hasVisit);
  const [isSaving, startSaving] = useTransition();
  const [isPublishing, startPublishing] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null;

  function addBlock(type: BlockType) {
    const block = {
      id: crypto.randomUUID(),
      type,
      config: defaultConfigFor(type),
      minTier: null,
    } as BuilderBlock;
    setBlocks((prev) => [...prev, block]);
    setSelectedBlockId(block.id);
  }

  function updateSelectedBlockConfig(config: BlockConfig) {
    if (!selectedBlockId) return;
    setBlocks((prev) =>
      prev.map((b) => (b.id === selectedBlockId ? ({ ...b, config } as BuilderBlock) : b))
    );
  }

  function updateSelectedBlockMinTier(minTier: string | null) {
    if (!selectedBlockId) return;
    setBlocks((prev) => prev.map((b) => (b.id === selectedBlockId ? { ...b, minTier } : b)));
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function switchPage(pageId: string) {
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
    setBlocks((data ?? []).map(toBuilderBlock));
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
    setSelectedBlockId(null);
  }

  /** Persists the current page's blocks. Returns whether it succeeded so
   * `togglePublish` can bail out instead of publishing a stale page. */
  async function saveBlocks(): Promise<boolean> {
    const res = await fetch(`/api/apps/${currentApp.id}/pages/${currentPageId}/blocks`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: blocks.map((b, index) => ({
          type: b.type,
          config: b.config,
          min_tier: b.minTier,
          position: index,
        })),
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      toast.error(body.error ?? "Failed to save");
      return false;
    }
    setBlocks((body.blocks as BlockRow[]).map(toBuilderBlock));
    return true;
  }

  function save() {
    startSaving(async () => {
      if (await saveBlocks()) toast.success("Saved");
    });
  }

  function togglePublish() {
    const nextStatus = currentApp.status === "published" ? "draft" : "published";
    startPublishing(async () => {
      // Publishing saves the canvas first — otherwise "Publish" only flips
      // the status and a creator who never clicked Save ships an empty
      // page (exactly what happened the first time this was used).
      if (nextStatus === "published" && !(await saveBlocks())) return;

      const res = await fetch(`/api/apps/${currentApp.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to update publish status");
        return;
      }
      setCurrentApp(body.app);
      toast.success(nextStatus === "published" ? "Saved and published" : "App unpublished");
    });
  }

  const currentPage = pages.find((p) => p.id === currentPageId);
  const currentPagePath = currentPage?.path;
  const live = currentApp.status === "published";
  // Protocol-relative, like the other links to the published app, so it also works on localhost.
  const liveUrl = live ? `//${currentApp.slug}.${rootDomain}` : null;
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
      window.dispatchEvent(new CustomEvent("open-app-settings", { detail: { tab: "theme" } }));
    } else if (step === "publish") {
      togglePublish();
    } else if (step === "visit") {
      // The app's page has the QR code; the step ticks itself once someone actually opens the app.
      window.open(`/dashboard/apps/${currentApp.id}`, "_blank", "noopener");
    }
  }

  return (
    <>
    <BuilderPhoneNotice name={currentApp.name} live={live} liveUrl={liveUrl} />
    <div className="dark hidden h-[calc(100dvh-3.5rem)] flex-col bg-neutral-950 text-neutral-50 lg:flex">
      <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="All apps"
            title="All apps"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <AppMark app={currentApp} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15px] font-semibold tracking-tight">{currentApp.name}</h1>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  live ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30" : "bg-white/5 text-neutral-400 ring-1 ring-inset ring-white/10"
                }`}
              >
                <span className="relative flex h-1.5 w-1.5">
                  {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                  <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-400" : "bg-neutral-500"}`} />
                </span>
                {live ? "Live" : "Draft"}
              </span>
            </div>
            <a
              href={`//${currentApp.slug}.${rootDomain}`}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1 truncate text-xs text-neutral-500 transition hover:text-white sm:inline-flex"
            >
              {currentApp.slug}.{rootDomain} <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!checklist.complete && (
            <button
              type="button"
              onClick={() => setSelectedBlockId(null)}
              title="Show the Get live checklist"
              className="hidden items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-200 ring-1 ring-white/10 transition hover:bg-white/10 md:inline-flex"
            >
              <span className="h-1.5 w-12 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full rounded-full bg-gradient-to-r from-indigo-400 to-pink-400" style={{ width: `${(checklist.doneCount / checklist.total) * 100}%` }} />
              </span>
              Get live · {checklist.doneCount}/{checklist.total}
            </button>
          )}
          <DeviceFrameSwitcher value={device} onChange={setDevice} />
          <AppSettingsDialog app={currentApp} pages={pages} onSaved={setCurrentApp} domainsEnabled={domainsEnabled} rootDomain={rootDomain} />
          <span className="mx-1 h-6 w-px bg-white/10" aria-hidden />
          {live ? (
            <>
              <button
                type="button"
                onClick={togglePublish}
                disabled={isPublishing}
                className="inline-flex h-9 items-center rounded-full px-3 text-xs font-medium text-neutral-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                {isPublishing ? "Unpublishing…" : "Unpublish"}
              </button>
              <button type="button" onClick={save} disabled={isSaving} className={PRIMARY}>
                <Save className="h-4 w-4" /> {isSaving ? "Saving…" : "Save changes"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={save}
                disabled={isSaving}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-medium text-neutral-200 transition hover:bg-white/10 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {isSaving ? "Saving…" : "Save draft"}
              </button>
              <button type="button" onClick={togglePublish} disabled={isPublishing} className={PRIMARY}>
                <Rocket className="h-4 w-4" /> {isPublishing ? "Publishing…" : "Publish"}
              </button>
            </>
          )}
        </div>
      </header>

      <PageTabs pages={pages} currentPageId={currentPageId} onSelect={switchPage} onCreate={createPage} />

      <div className="grid flex-1 grid-cols-[260px_1fr_320px] overflow-hidden">
        <aside className="overflow-y-auto border-r border-white/[0.06] bg-neutral-950">
          <Palette onAdd={addBlock} mapsEnabled={mapsEnabled} />
        </aside>

        <div className="relative overflow-y-auto pb-14 pt-6">
          {/* Workspace backdrop: the dashboard hero's two glows and dot texture. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-indigo-600/20 blur-3xl" />
            <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-pink-500/15 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]" />
          </div>
          <div className="relative mb-5 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/70 px-3.5 py-1.5 text-xs text-neutral-400 backdrop-blur">
              <span className="font-semibold text-neutral-100">{currentPage?.name ?? "Page"}</span>
              <span aria-hidden>·</span>
              {blocks.length} block{blocks.length === 1 ? "" : "s"}
              {blocks.length > 1 && (
                <>
                  <span aria-hidden>·</span> drag to reorder
                </>
              )}
            </span>
          </div>
          <MobilePreviewFrame device={device} theme={currentApp.theme}>
            <AppHeader theme={currentApp.theme} />
            <div className="flex-1 overflow-y-auto">
              <DndContext id="builder-blocks" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.length === 0 ? (
                    <div className="m-4 rounded-2xl border border-dashed border-border p-6 text-center">
                      <p className="text-sm font-medium">This page is empty</p>
                      <p className="mt-1 text-xs text-muted-foreground">Pick a block on the left to start building.</p>
                    </div>
                  ) : (
                    blocks.map((block) => (
                      <SortableBlockItem
                        key={block.id}
                        block={block}
                        selected={block.id === selectedBlockId}
                        onSelect={() => setSelectedBlockId(block.id)}
                        onRemove={() => removeBlock(block.id)}
                      />
                    ))
                  )}
                </SortableContext>
              </DndContext>
            </div>
            {/* Non-navigating preview: clicking a tab switches the builder's
                current page (if one matches its path) the same way clicking
                a page tab does, rather than performing a real navigation. */}
            <BottomNav
              items={currentApp.theme.bottom_nav ?? []}
              activePagePath={currentPagePath}
              onNavigate={(pagePath) => {
                const target = pages.find((p) => p.path === pagePath);
                if (target) switchPage(target.id);
              }}
            />
          </MobilePreviewFrame>
        </div>

        <aside className="overflow-y-auto border-l border-white/[0.06] bg-neutral-950">
          <Inspector
            block={selectedBlock}
            pageName={currentPage?.name ?? "This page"}
            blocks={blocks}
            onSelect={setSelectedBlockId}
            onClose={() => setSelectedBlockId(null)}
            checklist={checklist}
            liveUrl={liveUrl}
            publishing={isPublishing}
            onChecklistAction={runChecklistStep}
            appId={currentApp.id}
            organizationId={currentApp.organization_id}
            onChange={updateSelectedBlockConfig}
            onMinTierChange={updateSelectedBlockMinTier}
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
    // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
    return <img src={app.manifest.icon_url} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-md" />;
  }
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-md ${brand ? "" : tile.classes}`}
      style={brand ? { background: `linear-gradient(135deg, ${brand} 0%, color-mix(in oklab, ${brand} 45%, #0a0a0a) 100%)` } : undefined}
    >
      {tileInitial(app.name)}
    </span>
  );
}

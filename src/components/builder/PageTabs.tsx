"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, ArrowRight, ChevronDown, Copy, Eye, EyeOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageUploadField } from "@/components/builder/ImageUploadField";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/types/database";

type PageRow = Database["public"]["Tables"]["pages"]["Row"];

export interface PageSeo {
  seo_title: string;
  seo_description: string;
  share_image_url: string;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

/** What can be done to a page from its tab. The builder does the work; the tabs only ask. */
export interface PageActions {
  rename: (pageId: string, name: string) => Promise<void>;
  move: (pageId: string, direction: -1 | 1) => Promise<void>;
  duplicate: (pageId: string) => Promise<void>;
  remove: (pageId: string) => Promise<void>;
  /** Whether the page has a tab in the menu, and the switch for it. */
  inMenu: (page: PageRow) => boolean;
  setInMenu: (page: PageRow, show: boolean) => Promise<void>;
  /** Saves this page's search-engine title, description and share picture. */
  updateSeo: (pageId: string, seo: PageSeo) => Promise<void>;
}

export function PageTabs({
  pages,
  currentPageId,
  organizationId,
  onSelect,
  onCreate,
  actions,
}: {
  pages: PageRow[];
  currentPageId: string;
  organizationId: string;
  onSelect: (pageId: string) => void;
  onCreate: (name: string, path: string) => Promise<void>;
  actions: PageActions;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<PageRow | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [seoEditing, setSeoEditing] = useState<PageRow | null>(null);
  const [seo, setSeo] = useState<PageSeo>({ seo_title: "", seo_description: "", share_image_url: "" });
  const [seoBusy, setSeoBusy] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await onCreate(trimmed, slugify(trimmed));
      setOpen(false);
      setName("");
    } finally {
      setCreating(false);
    }
  }

  async function handleRename() {
    if (!renaming || !newName.trim()) return;
    setBusy(true);
    try {
      await actions.rename(renaming.id, newName.trim());
      setRenaming(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSeo() {
    if (!seoEditing) return;
    setSeoBusy(true);
    try {
      await actions.updateSeo(seoEditing.id, seo);
      setSeoEditing(null);
    } finally {
      setSeoBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-white/[0.06] bg-neutral-950 px-3 py-2">
      <span className="text-sm font-medium text-neutral-300">Pages</span>
      <div className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-0.5">
        {pages.map((page, index) => {
          const current = page.id === currentPageId;
          const hidden = !actions.inMenu(page);
          return (
            <div key={page.id} className={cn("inline-flex items-center rounded-full transition", current ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-200 hover:text-white")}>
              <button type="button" onClick={() => onSelect(page.id)} className={cn("rounded-full py-1 pl-3 text-sm font-medium", current ? "pr-1" : "pr-3")} title={hidden ? "Not in the menu" : undefined}>
                {hidden && <EyeOff className="mr-1 inline h-3 w-3 opacity-60" aria-label="Not in the menu" />}
                {page.name}
              </button>
              {/* The current page's menu: rename, move, duplicate, show or hide in the menu, delete. */}
              {current && (
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label={`Options for the ${page.name} page`} className="grid h-6 w-6 place-items-center rounded-full text-neutral-600 hover:bg-neutral-200 hover:text-neutral-950">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="dark">
                    <DropdownMenuItem
                      onClick={() => {
                        setRenaming(page);
                        setNewName(page.name);
                      }}
                    >
                      <Pencil className="h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={index === 0} onClick={() => void actions.move(page.id, -1)}>
                      <ArrowLeft className="h-4 w-4" /> Move left
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={index === pages.length - 1} onClick={() => void actions.move(page.id, 1)}>
                      <ArrowRight className="h-4 w-4" /> Move right
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void actions.duplicate(page.id)}>
                      <Copy className="h-4 w-4" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void actions.setInMenu(page, hidden)}>
                      {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {hidden ? "Show in the menu" : "Hide from the menu"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSeo({ seo_title: page.seo_title ?? "", seo_description: page.seo_description ?? "", share_image_url: page.share_image_url ?? "" });
                        setSeoEditing(page);
                      }}
                    >
                      <Search className="h-4 w-4" /> Search & sharing
                    </DropdownMenuItem>
                    {!page.is_home && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => void actions.remove(page.id)}>
                          <Trash2 className="h-4 w-4" /> Delete page
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button type="button" variant="ghost" className="h-7 gap-1 rounded-full px-2.5 text-sm text-neutral-200 hover:bg-white/10 hover:text-white" aria-label="New page">
              <Plus className="h-4 w-4" /> Add page
            </Button>
          }
        />
        <DialogContent className="dark">
          <DialogHeader>
            <DialogTitle>New page</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-page-name">Page name</Label>
            <Input id="new-page-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="About us" />
            {name.trim() && <p className="text-xs text-muted-foreground">Its address: /{slugify(name)}</p>}
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleCreate} disabled={!name.trim() || creating}>
              {creating ? "Creating…" : "Create page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="dark">
          <DialogHeader>
            <DialogTitle>Rename page</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-page-name">Page name</Label>
            <Input
              id="rename-page-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleRename()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">The menu shows this name. The page&apos;s address stays the same, so links to it keep working.</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => void handleRename()} disabled={!newName.trim() || busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!seoEditing} onOpenChange={(o) => !o && setSeoEditing(null)}>
        <DialogContent className="dark max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search & sharing{seoEditing ? ` · ${seoEditing.name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">What shows up when this page is found on Google, or shared on iMessage, WhatsApp or social media. Leave blank to use the page name.</p>
            <div className="space-y-1">
              <Label htmlFor="seo-title">Title</Label>
              <Input id="seo-title" maxLength={70} value={seo.seo_title} onChange={(e) => setSeo({ ...seo, seo_title: e.target.value })} placeholder={seoEditing?.name} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="seo-description">Description</Label>
              <Textarea id="seo-description" maxLength={200} rows={3} value={seo.seo_description} onChange={(e) => setSeo({ ...seo, seo_description: e.target.value })} placeholder="A sentence or two describing this page" />
            </div>
            <ImageUploadField id="seo-share-image" label="Share picture" organizationId={organizationId} value={seo.share_image_url} onChange={(share_image_url) => setSeo({ ...seo, share_image_url })} />
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => void handleSaveSeo()} disabled={seoBusy}>
              {seoBusy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

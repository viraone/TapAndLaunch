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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Palette } from "@/components/builder/Palette";
import { Inspector } from "@/components/builder/Inspector";
import { PageTabs } from "@/components/builder/PageTabs";
import { SortableBlockItem } from "@/components/builder/SortableBlockItem";
import { MobilePreviewFrame, DeviceFrameSwitcher, type DeviceFrame } from "@/components/builder/MobilePreviewFrame";
import { AppSettingsDialog } from "@/components/builder/AppSettingsDialog";
import { BottomNav } from "@/components/pwa-runtime/BottomNav";
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
  initialPages,
  initialPageId,
  initialBlocks,
}: {
  app: AppRow;
  initialPages: PageRow[];
  initialPageId: string;
  initialBlocks: BlockRow[];
}) {
  const supabase = createClient();

  const [currentApp, setCurrentApp] = useState(app);
  const [pages, setPages] = useState(initialPages);
  const [currentPageId, setCurrentPageId] = useState(initialPageId);
  const [blocks, setBlocks] = useState<BuilderBlock[]>(initialBlocks.map(toBuilderBlock));
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceFrame>("ios");
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

  function save() {
    startSaving(async () => {
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
        return;
      }
      setBlocks((body.blocks as BlockRow[]).map(toBuilderBlock));
      toast.success("Saved");
    });
  }

  function togglePublish() {
    const nextStatus = currentApp.status === "published" ? "draft" : "published";
    startPublishing(async () => {
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
      toast.success(nextStatus === "published" ? "App published" : "App unpublished");
    });
  }

  const currentPagePath = pages.find((p) => p.id === currentPageId)?.path;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold">{currentApp.name}</h1>
          <Badge variant={currentApp.status === "published" ? "default" : "secondary"}>
            {currentApp.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <DeviceFrameSwitcher value={device} onChange={setDevice} />
          <AppSettingsDialog app={currentApp} pages={pages} onSaved={setCurrentApp} />
          <Button type="button" variant="outline" onClick={save} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" onClick={togglePublish} disabled={isPublishing}>
            {currentApp.status === "published" ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </header>

      <PageTabs pages={pages} currentPageId={currentPageId} onSelect={switchPage} onCreate={createPage} />

      <div className="grid flex-1 grid-cols-[220px_1fr_280px] overflow-hidden">
        <aside className="overflow-y-auto border-r">
          <Palette onAdd={addBlock} />
        </aside>

        <div className="overflow-y-auto bg-muted/20 py-8">
          <MobilePreviewFrame device={device}>
            <div className="flex-1 overflow-y-auto">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.length === 0 ? (
                    <p className="p-6 text-center text-sm text-muted-foreground">
                      Add a block from the left to get started.
                    </p>
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

        <aside className="overflow-y-auto border-l">
          <Inspector
            block={selectedBlock}
            organizationId={currentApp.organization_id}
            onChange={updateSelectedBlockConfig}
            onMinTierChange={updateSelectedBlockMinTier}
          />
        </aside>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type PageRow = Database["public"]["Tables"]["pages"]["Row"];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function PageTabs({
  pages,
  currentPageId,
  onSelect,
  onCreate,
}: {
  pages: PageRow[];
  currentPageId: string;
  onSelect: (pageId: string) => void;
  onCreate: (name: string, path: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

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

  return (
    <div className="flex items-center gap-1 border-b bg-muted/30 px-2 py-1">
      {pages.map((page) => (
        <button
          key={page.id}
          type="button"
          onClick={() => onSelect(page.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm",
            page.id === currentPageId ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:bg-background/60"
          )}
        >
          {page.name}
        </button>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button type="button" variant="ghost" size="icon" className="ml-1 h-7 w-7">
              <Plus className="h-4 w-4" />
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New page</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-page-name">Page name</Label>
            <Input
              id="new-page-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="About us"
            />
            {name.trim() && (
              <p className="text-xs text-muted-foreground">Path: /{slugify(name)}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleCreate} disabled={!name.trim() || creating}>
              {creating ? "Creating…" : "Create page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

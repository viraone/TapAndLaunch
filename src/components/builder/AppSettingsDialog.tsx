"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Trash2, Plus } from "lucide-react";
import { ImageUploadField } from "@/components/builder/ImageUploadField";
import { DomainSettings } from "@/components/builder/DomainSettings";
import type { Database, ManifestConfig, ThemeConfig } from "@/types/database";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];
type PageRow = Database["public"]["Tables"]["pages"]["Row"];

export function AppSettingsDialog({
  app,
  pages,
  onSaved,
}: {
  app: AppRow;
  pages: PageRow[];
  onSaved: (app: AppRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("theme");

  // Lets the "Get live" checklist open this dialog straight on a tab
  // (e.g. the icon), without reaching into it from outside.
  useEffect(() => {
    function onOpen(e: Event) {
      setTab((e as CustomEvent<{ tab?: string }>).detail?.tab ?? "theme");
      setOpen(true);
    }
    window.addEventListener("open-app-settings", onOpen);
    return () => window.removeEventListener("open-app-settings", onOpen);
  }, []);
  const [theme, setTheme] = useState<ThemeConfig>(app.theme);
  const [manifest, setManifest] = useState<ManifestConfig>(app.manifest);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, manifest }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to save settings");
        return;
      }
      onSaved(body.app);
      toast.success("Settings saved");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const bottomNav = theme.bottom_nav ?? [];

  function updateNavItem(index: number, patch: Partial<NonNullable<ThemeConfig["bottom_nav"]>[number]>) {
    setTheme((t) => ({
      ...t,
      bottom_nav: bottomNav.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function addNavItem() {
    setTheme((t) => ({
      ...t,
      bottom_nav: [...bottomNav, { label: "New tab", icon: "home", page_path: pages[0]?.path ?? "" }],
    }));
  }

  function removeNavItem(index: number) {
    setTheme((t) => ({ ...t, bottom_nav: bottomNav.filter((_, i) => i !== index) }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon" className="rounded-full text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="App settings" data-app-settings>
            <Settings className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent className="dark max-w-lg">
        <DialogHeader>
          <DialogTitle>App settings</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="theme" className="flex-1">
              Theme
            </TabsTrigger>
            <TabsTrigger value="manifest" className="flex-1">
              App icon &amp; manifest
            </TabsTrigger>
            <TabsTrigger value="domain" className="flex-1">
              Domain
            </TabsTrigger>
          </TabsList>

          <TabsContent value="theme" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="theme-primary">Primary color</Label>
                <Input
                  id="theme-primary"
                  type="color"
                  value={theme.primary_color ?? "#000000"}
                  onChange={(e) => setTheme({ ...theme, primary_color: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="theme-bg">Background color</Label>
                <Input
                  id="theme-bg"
                  type="color"
                  value={theme.background_color ?? "#ffffff"}
                  onChange={(e) => setTheme({ ...theme, background_color: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="theme-font">Font family</Label>
              <Input
                id="theme-font"
                placeholder="e.g. Inter, system-ui"
                value={theme.font_family ?? ""}
                onChange={(e) => setTheme({ ...theme, font_family: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="theme-header">Header title</Label>
              <Input
                id="theme-header"
                value={theme.header_title ?? ""}
                onChange={(e) => setTheme({ ...theme, header_title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Bottom navigation</Label>
              {bottomNav.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Label"
                    value={item.label}
                    onChange={(e) => updateNavItem(index, { label: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Icon"
                    value={item.icon}
                    onChange={(e) => updateNavItem(index, { icon: e.target.value })}
                    className="w-20"
                  />
                  <Select
                    value={item.page_path}
                    items={Object.fromEntries(pages.map((page) => [page.path, page.name]))}
                    onValueChange={(value) => updateNavItem(index, { page_path: value ?? "" })}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Page" />
                    </SelectTrigger>
                    <SelectContent>
                      {pages.map((page) => (
                        <SelectItem key={page.id} value={page.path}>
                          {page.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeNavItem(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addNavItem}>
                <Plus className="mr-1 h-4 w-4" /> Add tab
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="manifest" className="space-y-4">
            <ImageUploadField
              id="manifest-icon"
              label="App icon"
              organizationId={app.organization_id}
              value={manifest.icon_url ?? ""}
              onChange={(icon_url) => setManifest({ ...manifest, icon_url })}
            />
            <div className="space-y-1">
              <Label htmlFor="manifest-name">App name</Label>
              <Input
                id="manifest-name"
                value={manifest.name ?? ""}
                onChange={(e) => setManifest({ ...manifest, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="manifest-short-name">Short name</Label>
              <Input
                id="manifest-short-name"
                maxLength={12}
                value={manifest.short_name ?? ""}
                onChange={(e) => setManifest({ ...manifest, short_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="manifest-description">Description</Label>
              <Textarea
                id="manifest-description"
                rows={2}
                value={manifest.description ?? ""}
                onChange={(e) => setManifest({ ...manifest, description: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Display mode</Label>
              <Select
                value={manifest.display ?? "standalone"}
                items={{ standalone: "Standalone", fullscreen: "Fullscreen", "minimal-ui": "Minimal UI", browser: "Browser" }}
                onValueChange={(value) => setManifest({ ...manifest, display: value as ManifestConfig["display"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standalone">Standalone</SelectItem>
                  <SelectItem value="fullscreen">Fullscreen</SelectItem>
                  <SelectItem value="minimal-ui">Minimal UI</SelectItem>
                  <SelectItem value="browser">Browser</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="domain">
            <DomainSettings app={app} onUpdated={onSaved} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

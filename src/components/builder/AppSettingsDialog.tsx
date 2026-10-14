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
import { SOCIAL_KINDS } from "@/components/pwa-runtime/SiteFooter";

/** The pictures a tab can have, in plain words (the names are what `BottomNav` draws). */
const NAV_ICONS: Record<string, string> = {
  home: "Home",
  calendar: "Calendar",
  info: "Info",
  mail: "Mail",
  user: "Person",
  shop: "Shopping",
  search: "Search",
  settings: "Settings",
  plus: "Plus",
  pencil: "Pencil",
};

/** How the app opens once someone adds it to their phone's home screen. */
const DISPLAY_MODES: Record<string, string> = {
  standalone: "Like an app, with no browser bar (recommended)",
  fullscreen: "Full screen, no bars at all",
  "minimal-ui": "Like an app, with a small browser bar",
  browser: "In the browser, like any website",
};
import type { Database, ManifestConfig, ThemeConfig } from "@/types/database";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];
type PageRow = Database["public"]["Tables"]["pages"]["Row"];

export function AppSettingsDialog({
  app,
  pages,
  onSaved,
  domainsEnabled,
  rootDomain,
  kind,
}: {
  app: AppRow;
  pages: PageRow[];
  onSaved: (app: AppRow) => void;
  /** False until the server has its Vercel keys; the tab then says "coming soon". */
  domainsEnabled: boolean;
  rootDomain: string;
  /** An AI-written (BYOB) app has no block theme: it gets the icon & manifest and domain tabs only. */
  kind?: "blocks" | "code";
}) {
  const code = kind === "code";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(code ? "manifest" : "theme");

  // Lets the "Get live" checklist open this dialog straight on a tab
  // (e.g. the icon), without reaching into it from outside.
  useEffect(() => {
    function onOpen(e: Event) {
      setTab((e as CustomEvent<{ tab?: string }>).detail?.tab ?? (code ? "manifest" : "theme"));
      setOpen(true);
    }
    window.addEventListener("open-app-settings", onOpen);
    return () => window.removeEventListener("open-app-settings", onOpen);
  }, [code]);
  const [theme, setTheme] = useState<ThemeConfig>(app.theme);
  const [manifest, setManifest] = useState<ManifestConfig>(app.manifest);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(code ? { manifest } : { theme: { ...theme, looks_confirmed: true }, manifest }),
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
          // A gear on its own said nothing to a first-timer; the button names what is behind it.
          <Button type="button" variant="ghost" className="h-9 rounded-full px-3 text-xs font-medium text-neutral-300 hover:bg-white/10 hover:text-white" aria-label="Design, icon, domain and other settings" data-app-settings>
            <Settings className="h-4 w-4" /> Design &amp; settings
          </Button>
        }
      />
      <DialogContent className="dark max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>App settings</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            {!code && (
              <TabsTrigger value="theme" className="flex-1">
                Theme
              </TabsTrigger>
            )}
            <TabsTrigger value="manifest" className="flex-1">
              Icon &amp; name
            </TabsTrigger>
            <TabsTrigger value="domain" className="flex-1">
              Domain
            </TabsTrigger>
          </TabsList>

          <TabsContent value="theme" className="space-y-4">
            <div className="space-y-2">
              <Label>Layout</Label>
              <div role="group" aria-label="Layout" className="grid grid-cols-2 gap-2">
                {([
                  { value: "app", title: "App", hint: "A phone-shaped app on every screen. Best for things people open on their phone." },
                  { value: "website", title: "Website", hint: "Full width on a laptop with a menu of your pages at the top. On a phone it looks like the app." },
                ] as const).map((option) => {
                  const selected = (theme.layout ?? "app") === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setTheme({ ...theme, layout: option.value })}
                      className={`rounded-2xl border p-3 text-left transition ${selected ? "border-white bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
                    >
                      <p className="text-sm font-semibold">{option.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{option.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>
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
              <Label htmlFor="theme-font">Font (optional)</Label>
              <Input
                id="theme-font"
                placeholder="Leave empty for the standard font"
                value={theme.font_family ?? ""}
                onChange={(e) => setTheme({ ...theme, font_family: e.target.value })}
              />
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div>
                <p className="text-sm font-semibold">Header bar</p>
                <p className="text-xs text-muted-foreground">Shown at the top of every page. Leave all three empty for no header.</p>
              </div>
              <ImageUploadField
                id="theme-header-logo"
                label="Logo"
                organizationId={app.organization_id}
                value={theme.header_logo_url ?? ""}
                onChange={(header_logo_url) => setTheme({ ...theme, header_logo_url })}
              />
              <div className="space-y-1">
                <Label htmlFor="theme-header">Name</Label>
                <Input
                  id="theme-header"
                  maxLength={80}
                  value={theme.header_title ?? ""}
                  onChange={(e) => setTheme({ ...theme, header_title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="theme-tagline">Tagline</Label>
                <Input
                  id="theme-tagline"
                  maxLength={120}
                  placeholder="Every Friday · 7–9 PM"
                  value={theme.header_tagline ?? ""}
                  onChange={(e) => setTheme({ ...theme, header_tagline: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div>
                <p className="text-sm font-semibold">Footer</p>
                <p className="text-xs text-muted-foreground">The bottom of every page: a line of text and your social links.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="footer-text">Text</Label>
                <Input id="footer-text" maxLength={200} placeholder="© 2026 David Babu Comedy · Seattle" value={theme.footer?.text ?? ""} onChange={(e) => setTheme({ ...theme, footer: { ...theme.footer, text: e.target.value } })} />
              </div>
              {(theme.footer?.social ?? []).map((link, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={link.kind}
                    items={Object.fromEntries(Object.entries(SOCIAL_KINDS).map(([k, v]) => [k, v.label]))}
                    onValueChange={(kind) => setTheme({ ...theme, footer: { ...theme.footer, social: (theme.footer?.social ?? []).map((l, i) => (i === index ? { ...l, kind: kind ?? "website" } : l)) } })}
                  >
                    <SelectTrigger className="w-32" aria-label="Which site">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SOCIAL_KINDS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label="Address"
                    placeholder={link.kind === "email" ? "you@example.com" : "https://…"}
                    value={link.url}
                    onChange={(e) => setTheme({ ...theme, footer: { ...theme.footer, social: (theme.footer?.social ?? []).map((l, i) => (i === index ? { ...l, url: e.target.value } : l)) } })}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove this link" onClick={() => setTheme({ ...theme, footer: { ...theme.footer, social: (theme.footer?.social ?? []).filter((_, i) => i !== index) } })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setTheme({ ...theme, footer: { ...theme.footer, social: [...(theme.footer?.social ?? []), { kind: "instagram", url: "" }] } })}>
                <Plus className="mr-1 h-4 w-4" /> Add a social link
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Tabs at the bottom (and the menu at the top of a website)</Label>
              <p className="text-xs text-muted-foreground">Each tab needs a name, a picture and the page it opens.</p>
              {bottomNav.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Label"
                    value={item.label}
                    onChange={(e) => updateNavItem(index, { label: e.target.value })}
                    className="flex-1"
                  />
                  <Select value={NAV_ICONS[item.icon] ? item.icon : "info"} items={NAV_ICONS} onValueChange={(value) => updateNavItem(index, { icon: value ?? "info" })}>
                    <SelectTrigger className="w-28" aria-label="Picture">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NAV_ICONS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              <Label htmlFor="manifest-short-name">Short name (under the icon on a phone, 12 letters at most)</Label>
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
              <Label>When opened from a phone&apos;s home screen</Label>
              <Select
                value={manifest.display ?? "standalone"}
                items={DISPLAY_MODES}
                onValueChange={(value) => setManifest({ ...manifest, display: value as ManifestConfig["display"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DISPLAY_MODES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="domain">
            {domainsEnabled ? (
              <DomainSettings app={app} onUpdated={onSaved} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
                <p className="font-semibold text-neutral-100">Custom domains are coming soon</p>
                <p className="mt-1.5 leading-relaxed text-neutral-400">
                  For now your app lives at{" "}
                  <span className="font-medium text-neutral-200">
                    {app.slug}.{rootDomain}
                  </span>
                  . Want your own address, like yourbusiness.com? Contact us and we&apos;ll set it up.
                </p>
              </div>
            )}
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

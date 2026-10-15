"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { ABOUT_MAX_LENGTH, STARTER_TEMPLATES, TEMPLATE_CATEGORIES, buildStarter, templateNeedsMaps, websiteDesigns, type StarterTemplate } from "@/lib/apps/templates";
import { fontsHref } from "@/lib/pwa/theme-style";
import { slugify } from "@/lib/apps/slug";
import { TemplatePreview } from "@/components/dashboard/TemplatePreview";
import { TEMPLATE_ICONS } from "@/components/dashboard/templateIcons";
import { ImageUploadField } from "@/components/builder/ImageUploadField";

const ICONS = TEMPLATE_ICONS;

// Two clearly separate shelves: full-width websites (today, just Website) and the phone-shaped templates
// (everything else). Split off "website" rather than listing the other categories by hand, so a future website
// category joins the Websites shelf automatically instead of landing among the phone-shaped ones.
const WEBSITE_CATEGORIES = TEMPLATE_CATEGORIES.filter((c) => c.id === "website");
const APP_CATEGORIES = TEMPLATE_CATEGORIES.filter((c) => c.id !== "website");

// The website mockups are set in each site's real fonts, so the picker loads the pairs the website starters use
// (a handful of Google Fonts stylesheets; React hoists the links into <head>).
const PICKER_FONTS = Array.from(
  new Set(STARTER_TEMPLATES.filter((t) => t.category === "website").map((t) => fontsHref(buildStarter(t.id, "x").theme)).filter((h): h is string => !!h))
);

// Name placeholders for the older templates; the website templates carry their own (`nameHint`/`aboutHint`).
const NAME_HINTS: Record<string, string> = {
  business: "Maple Street Bakery",
  store: "Corner Shop",
  events: "Sunday Supper Club",
  food: "Eats near me",
  gas: "Cheap gas",
  openmic: "Open mics tonight",
  blank: "My app",
  byob: "My AI-built app",
  restaurant: "Taco Loco",
  fitness: "Flow Yoga Studio",
  salon: "Bloom Hair Studio",
  community: "Ballard Neighbors",
};

type Step = "pick" | "about" | "name";

export function NewAppForm({ organizationId, rootDomain, mapsEnabled }: { organizationId: string; rootDomain: string; mapsEnabled: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<StarterTemplate | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [about, setAbout] = useState("");
  const [photo, setPhoto] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function pickTemplate(t: StarterTemplate) {
    setSelected(t);
    setAbout("");
    setPhoto("");
    setStep(t.asksAbout ? "about" : "name");
  }

  function backToGrid() {
    setSelected(null);
    setError(null);
    setStep("pick");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_id: organizationId,
        name,
        slug: slugify(name),
        template: selected.id,
        ...(selected.asksAbout && about.trim() ? { about: about.trim() } : {}),
        ...(selected.asksAbout && photo.trim() ? { hero_image: photo.trim() } : {}),
      }),
    });
    const body = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(body.error ?? "Something went wrong");
      return;
    }

    router.push(`/dashboard/apps/${body.app.id}/builder`);
  }

  if (selected && step === "about") {
    const Icon = ICONS[selected.icon];
    return (
      <div className="mx-auto w-full max-w-xl">
        <button
          type="button"
          onClick={backToGrid}
          className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-950"
        >
          <ArrowLeft className="h-4 w-4" /> Pick a different starter
        </button>
        <div className="rounded-3xl bg-white p-7 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:p-9">
          <div className="flex items-center gap-4">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${selected.color}, color-mix(in oklab, ${selected.color} 55%, #0a0a0a))` }}
            >
              <Icon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Starting from</p>
              <h2 className="truncate text-xl font-semibold tracking-tight">{selected.name}</h2>
            </div>
          </div>

          <label htmlFor="app-about" className="mt-7 block text-sm font-semibold">
            What&apos;s your site about?
          </label>
          <p className="mt-0.5 text-sm text-neutral-500">A sentence is plenty. We&apos;ll use it to write your first draft — you can change every word after.</p>
          <textarea
            id="app-about"
            autoFocus
            rows={3}
            maxLength={ABOUT_MAX_LENGTH}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder={selected.aboutHint ?? "A sentence about what you do"}
            className="mt-3 w-full resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5"
          />
          {/* Their own face or shopfront at the top of the site before they ever see the builder: the moment the
              site stops being a template. Optional; the banner is their colour until there is a photo. */}
          <div className="mt-5">
            <ImageUploadField id="app-photo" label="A photo for the top of your site (optional)" organizationId={organizationId} value={photo} onChange={setPhoto} />
            <p className="mt-1 text-xs text-neutral-500">You, your work or your place. You can change it any time.</p>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep("name")}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-neutral-950 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
            {!about.trim() && !photo.trim() && (
              <button type="button" onClick={() => setStep("name")} className="text-sm font-medium text-neutral-500 transition hover:text-neutral-950">
                Skip
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (selected && step === "name") {
    const Icon = ICONS[selected.icon];
    return (
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl">
        <button
          type="button"
          onClick={() => (selected.asksAbout ? setStep("about") : backToGrid())}
          className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-950"
        >
          <ArrowLeft className="h-4 w-4" /> {selected.asksAbout ? "Back" : "Pick a different starter"}
        </button>
        <div className="rounded-3xl bg-white p-7 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:p-9">
          <div className="flex items-center gap-4">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${selected.color}, color-mix(in oklab, ${selected.color} 55%, #0a0a0a))` }}
            >
              <Icon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Starting from</p>
              <h2 className="truncate text-xl font-semibold tracking-tight">{selected.name}</h2>
            </div>
          </div>

          <label htmlFor="app-name" className="mt-7 block text-sm font-semibold">
            What&apos;s it called?
          </label>
          <input
            id="app-name"
            required
            autoFocus
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={selected.nameHint ?? NAME_HINTS[selected.id] ?? "My app"}
            className="mt-2 h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base outline-none transition focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5"
          />
          <p className="mt-2 min-h-5 text-sm text-neutral-500">
            {slugify(name) ? (
              <>
                Your app will live at <span className="font-medium text-neutral-950">{slugify(name)}.{rootDomain}</span>
              </>
            ) : (
              "This becomes your app's web address. You can change the name later."
            )}
          </p>
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !slugify(name)}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-neutral-950 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Setting up your app…
              </>
            ) : (
              <>
                Create app <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div id="templates" className="scroll-mt-6" />
      {PICKER_FONTS.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      <TemplateGallery mapsEnabled={mapsEnabled} onSelect={pickTemplate} />
    </div>
  );
}

type Shelf = "all" | "website" | "phone";
const SHELVES: Array<{ id: Shelf; label: string }> = [
  { id: "all", label: "All" },
  { id: "website", label: "Websites" },
  { id: "phone", label: "Phone-first" },
];

const CARD = "group flex flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950";

/** Every template in one open grid, the way Squarespace lays out theirs: a row of filter pills with a result count,
 * then big edge-to-edge previews with just a name under each. "Websites" are full-size sites with a menu across the
 * top; "Phone-first" are simple phone-shaped pages visitors can save to their Home Screen. A website topic that
 * comes in several designs (Photography in five looks) opens its own grid of those designs instead of being picked
 * outright, the way picking "Photography" on Squarespace shows the photography templates. */
function TemplateGallery({ mapsEnabled, onSelect }: { mapsEnabled: boolean; onSelect: (t: StarterTemplate) => void }) {
  const [shelf, setShelf] = useState<Shelf>("all");
  const [topic, setTopic] = useState<StarterTemplate | null>(null);
  const available = STARTER_TEMPLATES.filter((t) => mapsEnabled || !templateNeedsMaps(t.id));
  const order = [...WEBSITE_CATEGORIES, ...APP_CATEGORIES].map((c) => c.id as string);
  const cards = available
    .filter((t) => shelf === "all" || (shelf === "website") === (t.category === "website"))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

  function openTopic(t: StarterTemplate) {
    setTopic(t);
    // The headline above is tall; bring the designs up to where the filter row was.
    document.getElementById("templates")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (topic) return <DesignGrid topic={topic} onBack={() => setTopic(null)} onSelect={onSelect} />;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-neutral-200 pt-6">
        <p className="text-base font-medium text-neutral-950">{cards.length} templates</p>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {SHELVES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setShelf(s.id)}
              aria-pressed={shelf === s.id}
              className={`h-10 rounded-full px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 ${
                shelf === s.id ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="w-full text-sm text-neutral-500 sm:ml-auto sm:w-auto">
          {shelf === "phone"
            ? "Simple phone-shaped pages your visitors can save to their Home Screen."
            : shelf === "website"
              ? "Full-size sites with a menu across the top. Each comes in five looks."
              : "Websites and phone-first pages, all filled in so you can preview them right away."}
        </p>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((t) => {
          const designs = websiteDesigns(t.id).length;
          return (
            <button key={t.id} type="button" onClick={() => (designs > 1 ? openTopic(t) : onSelect(t))} className={CARD}>
              <Preview templateId={t.id} color={t.color} action={designs > 1 ? `See ${designs} designs` : "Start with this"} />
              <div className="mt-3.5 flex items-baseline justify-between gap-3">
                <h4 className="min-w-0 truncate text-[17px] font-medium tracking-tight text-neutral-950">{t.name}</h4>
                {designs > 1 ? (
                  <span className="shrink-0 whitespace-nowrap text-xs text-neutral-500">{designs} designs</span>
                ) : (
                  t.includes.length > 0 && <span className="shrink-0 whitespace-nowrap text-xs text-neutral-500">{t.includes.slice(0, 3).join(" · ")}</span>
                )}
              </div>
              <p className="mt-1 line-clamp-1 text-sm text-neutral-500">{t.tagline}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** One topic's designs: the same site (same words, same sections) in each of the five looks, drawn from the theme
 * that design really gets, so the card is exactly the site. Picking one hands up the topic's card under the design's
 * own id (`photography--editorial`), which is what the create call and the "Starting from" line then use. */
function DesignGrid({ topic, onBack, onSelect }: { topic: StarterTemplate; onBack: () => void; onSelect: (t: StarterTemplate) => void }) {
  const designs = websiteDesigns(topic.id);
  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-neutral-200 pt-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-100 px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-200 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          <ArrowLeft className="h-4 w-4" /> All templates
        </button>
        <p className="text-base font-medium text-neutral-950">
          {topic.name} · {designs.length} designs
        </p>
        <p className="w-full text-sm text-neutral-500 sm:ml-auto sm:w-auto">The same site in five looks. Pick the one that feels like you; you can change it any time under Settings.</p>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {designs.map((d) => (
          <button key={d.id} type="button" onClick={() => onSelect({ ...topic, id: d.id, name: `${topic.name} · ${d.name}` })} className={CARD}>
            <Preview templateId={d.id} color={topic.color} action="Start with this" />
            <div className="mt-3.5 flex items-baseline justify-between gap-3">
              <h4 className="min-w-0 truncate text-[17px] font-medium tracking-tight text-neutral-950">{d.name}</h4>
              {topic.includes.length > 0 && <span className="shrink-0 whitespace-nowrap text-xs text-neutral-500">{topic.includes.slice(0, 3).join(" · ")}</span>}
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-neutral-500">{d.feel}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

/** The preview is the whole card: no frame around it, just a hairline; it eases up a touch on hover under a white
 * pill that says what clicking does. */
function Preview({ templateId, color, action }: { templateId: string; color: string; action: string }) {
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-black/10">
      <div className="h-full w-full transition duration-500 ease-out group-hover:scale-[1.03]">
        <TemplatePreview templateId={templateId} color={color} />
      </div>
      <span aria-hidden className="absolute inset-0 grid place-items-center bg-black/0 transition duration-300 group-hover:bg-black/25">
        <span className="translate-y-1 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 opacity-0 shadow-lg transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          {action}
        </span>
      </span>
    </div>
  );
}

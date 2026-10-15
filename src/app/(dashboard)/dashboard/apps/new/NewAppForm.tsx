"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Search } from "lucide-react";
import { ABOUT_MAX_LENGTH, STARTER_TEMPLATES, TEMPLATE_CATEGORIES, buildStarter, templateNeedsMaps, websiteDesigns, type StarterTemplate } from "@/lib/apps/templates";
import { WEBSITE_GOALS, type GoalId } from "@/lib/apps/goals";
import { fontsHref } from "@/lib/pwa/theme-style";
import { slugify } from "@/lib/apps/slug";
import { SiteFrame } from "@/components/dashboard/SiteFrame";
import { TEMPLATE_ICONS } from "@/components/dashboard/templateIcons";
import { ImageUploadField } from "@/components/builder/ImageUploadField";
import { NETWORK_ERROR, SERVER_ERROR } from "@/lib/friendly-errors";

const ICONS = TEMPLATE_ICONS;

// Two clearly separate shelves: full-width websites (today, just Website) and the phone-shaped templates
// (everything else). Split off "website" rather than listing the other categories by hand, so a future website
// category joins the Websites shelf automatically instead of landing among the phone-shaped ones.
const WEBSITE_CATEGORIES = TEMPLATE_CATEGORIES.filter((c) => c.id === "website");
const APP_CATEGORIES = TEMPLATE_CATEGORIES.filter((c) => c.id !== "website");

// The website mockups are set in each site's real fonts, so the picker loads the pairs the website starters use
// (a handful of Google Fonts stylesheets; React hoists the links into <head>).
const PICKER_FONTS = Array.from(
  new Set(STARTER_TEMPLATES.filter((t) => t.category === "website").flatMap((t) => websiteDesigns(t.id).map((d) => fontsHref(buildStarter(d.templateId, "x").theme))).filter((h): h is string => !!h))
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

/** How many designs a website starter comes in (the same for all of them). */
const DESIGN_COUNT = websiteDesigns("portfolio").length;

/** The picker's steps, in order. A website topic goes through all of them (its goals, then its designs); a
 * phone-first template skips straight from the pick to the name. */
type Step = "pick" | "goals" | "designs" | "about" | "name";

export function NewAppForm({ organizationId, rootDomain, mapsEnabled }: { organizationId: string; rootDomain: string; mapsEnabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("pick");
  /** The website topic being walked through (goals, then designs); null for a phone-first pick. */
  const [topic, setTopic] = useState<StarterTemplate | null>(null);
  const [goals, setGoals] = useState<GoalId[]>([]);
  /** The template the app is created from: a design of the topic (`photography--noir`) or a phone-first template. */
  const [selected, setSelected] = useState<StarterTemplate | null>(null);
  const [about, setAbout] = useState("");
  const [photo, setPhoto] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Closes the gap before `disabled={loading}` takes effect, so a fast double-click cannot create two apps.
  const submitting = useRef(false);

  function chooseCard(t: StarterTemplate) {
    if (websiteDesigns(t.id).length > 1) {
      setTopic(t);
      setGoals([]);
      setStep("goals");
      scrollToTemplates();
    } else {
      setTopic(null);
      setGoals([]);
      pickTemplate(t);
    }
  }

  function pickTemplate(t: StarterTemplate) {
    setSelected(t);
    setAbout("");
    setPhoto("");
    setStep(t.asksAbout ? "about" : "name");
  }

  function backToGrid() {
    setSelected(null);
    setTopic(null);
    setGoals([]);
    setError(null);
    setStep("pick");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError(null);

    // Whatever goes wrong (offline, a server error page instead of JSON), the button must come back with a sentence a
    // person can read; otherwise it sits on "Setting up your app…" for good.
    const fail = (message: string) => {
      setLoading(false);
      setError(message);
      submitting.current = false;
    };

    let res: Response;
    try {
      res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: organizationId,
          name,
          slug: slugify(name),
          template: selected.id,
          ...(selected.asksAbout && about.trim() ? { about: about.trim() } : {}),
          ...(selected.asksAbout && photo.trim() ? { hero_image: photo.trim() } : {}),
          ...(topic && goals.length ? { goals } : {}),
        }),
      });
    } catch {
      fail(NETWORK_ERROR);
      return;
    }

    const body: { error?: string; app?: { id: string } } | null = await res.json().catch(() => null);

    if (!res.ok || !body?.app) {
      fail(res.status === 401 ? "Your session has ended. Log in again, then create your app." : (typeof body?.error === "string" && body.error.trim() && res.status < 500 ? body.error : SERVER_ERROR));
      return;
    }

    // The guard stays on from here: this page is about to be replaced.
    router.push(`/dashboard/apps/${body.app.id}/builder`);
  }

  if (selected && step === "about") {
    const Icon = ICONS[selected.icon];
    return (
      <div className="mx-auto w-full max-w-xl">
        <button
          type="button"
          onClick={() => (topic ? setStep("designs") : backToGrid())}
          className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-950"
        >
          <ArrowLeft className="h-4 w-4" /> {topic ? "Pick a different design" : "Pick a different starter"}
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
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-[0_8px_20px_-10px_rgba(99,102,241,0.6)] transition hover:brightness-110"
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
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-[0_8px_20px_-10px_rgba(99,102,241,0.6)] transition hover:brightness-110 disabled:opacity-50"
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
      {topic && step === "goals" ? (
        <GoalsStep
          topic={topic}
          goals={goals}
          onChange={setGoals}
          onBack={backToGrid}
          onNext={() => {
            setStep("designs");
            scrollToTemplates();
          }}
        />
      ) : topic && step === "designs" ? (
        <DesignGrid
          topic={topic}
          goals={goals}
          onBack={() => {
            setStep("goals");
            scrollToTemplates();
          }}
          onSelect={pickTemplate}
        />
      ) : (
        <TemplateGallery mapsEnabled={mapsEnabled} onSelect={chooseCard} />
      )}
    </div>
  );
}

/** The headline above is tall; bring the step up to where the filter row was. */
function scrollToTemplates() {
  document.getElementById("templates")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type Shelf = "all" | "website" | "phone";
const SHELVES: Array<{ id: Shelf; label: string }> = [
  { id: "all", label: "All" },
  { id: "website", label: "Websites" },
  { id: "phone", label: "Phone-first" },
];

const CARD = "group flex flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950";
const PILL = "inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-100 px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-200 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950";
const DARK = "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-[0_8px_20px_-10px_rgba(99,102,241,0.6)] transition hover:brightness-110 disabled:opacity-50";

/** "Who's it for?": every template in one open grid, the way Squarespace lays out theirs: a search box, a
 * row of filter pills with a result count, then big previews with just a name under each. "Websites" are full-size
 * sites with a menu across the top; "Phone-first" are simple phone-shaped pages visitors can save to their Home
 * Screen. A website topic goes on to its goals and designs; a phone-first template is picked outright. */
function TemplateGallery({ mapsEnabled, onSelect }: { mapsEnabled: boolean; onSelect: (t: StarterTemplate) => void }) {
  const [shelf, setShelf] = useState<Shelf>("all");
  const [query, setQuery] = useState("");
  const available = STARTER_TEMPLATES.filter((t) => mapsEnabled || !templateNeedsMaps(t.id));
  const order = [...WEBSITE_CATEGORIES, ...APP_CATEGORIES].map((c) => c.id as string);
  const q = query.trim().toLowerCase();
  const cards = available
    .filter((t) => shelf === "all" || (shelf === "website") === (t.category === "website"))
    // Names and taglines only: the chips ("Photo banner") would make every phone-first card match "photo".
    .filter((t) => !q || `${t.name} ${t.tagline}`.toLowerCase().includes(q))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-neutral-200 pt-6">
        <p className="text-base font-medium text-neutral-950">Who&apos;s it for?</p>
        <label className="relative block w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by trade"
            aria-label="Search templates"
            className="h-10 w-full rounded-full bg-neutral-100 pl-10 pr-4 text-sm outline-none transition placeholder:text-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-950"
          />
        </label>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {SHELVES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setShelf(s.id)}
              aria-pressed={shelf === s.id}
              className={`h-10 rounded-full px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 ${
                shelf === s.id ? "bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-[0_8px_20px_-10px_rgba(99,102,241,0.6)] transition hover:brightness-110" : "bg-neutral-100 text-neutral-700 transition hover:bg-neutral-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="w-full text-sm text-neutral-500 sm:ml-auto sm:w-auto">
          {cards.length} {cards.length === 1 ? "template" : "templates"}
          {shelf === "phone"
            ? " · Simple phone-shaped pages your visitors can save to their Home Screen."
            : shelf === "website"
              ? ` · Full-size sites with a menu across the top, each in ${DESIGN_COUNT} designs.`
              : " · Websites and phone-first pages, all filled in so you can preview them right away."}
        </p>
      </div>
      {cards.length === 0 ? (
        <p className="mt-10 text-neutral-600">
          Nothing matches &ldquo;{query}&rdquo;. Try a trade (photography, consulting, café) or clear the search.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((t) => {
            const designs = websiteDesigns(t.id).length;
            return (
              <button key={t.id} type="button" onClick={() => onSelect(t)} className={CARD}>
                <Preview template={t} action={designs > 1 ? "Choose this" : "Start with this"} />
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
      )}
    </section>
  );
}

/** "What should it do for you?": the goals (lib/apps/goals.ts), each a ready-made section the site gets.
 * The ones the topic already ships are shown ticked and fixed, so a photographer sees that the gallery is in. */
function GoalsStep({ topic, goals, onChange, onBack, onNext }: { topic: StarterTemplate; goals: GoalId[]; onChange: (g: GoalId[]) => void; onBack: () => void; onNext: () => void }) {
  const built = buildStarter(topic.id, "x");
  const included = new Set(WEBSITE_GOALS.filter((g) => built.pages.some((p) => p.blocks.some((b) => b.type === g.block))).map((g) => g.id));
  const toggle = (id: GoalId, on: boolean) => onChange(on ? [...goals, id] : goals.filter((g) => g !== id));

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-neutral-200 pt-6">
        <button type="button" onClick={onBack} className={PILL}>
          <ArrowLeft className="h-4 w-4" /> All templates
        </button>
        <p className="text-base font-medium text-neutral-950">{topic.name} · What should it do for you?</p>
        <p className="w-full text-sm text-neutral-500 sm:ml-auto sm:w-auto">Tick what you need; each one adds a ready-made section. You can add or remove any of them later.</p>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WEBSITE_GOALS.map((g) => {
          const fixed = included.has(g.id);
          const on = fixed || goals.includes(g.id);
          return (
            <label
              key={g.id}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-4 ring-1 transition ${on ? "bg-neutral-50 ring-neutral-950" : "ring-neutral-200 hover:ring-neutral-400"} ${fixed ? "cursor-default" : ""}`}
            >
              <input type="checkbox" checked={on} disabled={fixed} onChange={(e) => toggle(g.id, e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-neutral-950" />
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-neutral-950">{g.label}</span>
                <span className="mt-0.5 block text-sm text-neutral-500">{fixed ? `Already part of ${topic.name}.` : g.blurb}</span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-6">
        <button type="button" onClick={onBack} className={PILL}>
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-4">
          {goals.length === 0 && (
            <button type="button" onClick={onNext} className="text-sm font-medium text-neutral-500 transition hover:text-neutral-950">
              Skip
            </button>
          )}
          <button type="button" onClick={onNext} className={DARK}>
            See {DESIGN_COUNT} designs <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

/** One topic's designs with the goals folded in: the same site (same words, same sections, plus the ones they asked
 * for) in each design (lib/apps/designs.ts), drawn from the theme and pages that design really gets, so the card is
 * exactly the site. The designs whose first screen fits the goals come first as "Best matches" (the work up front
 * for someone showing their work, the numbers up front for someone selling or booking), then all of them. Picking
 * one hands up the topic's card under the design's template id (`photography--noir`). */
function DesignGrid({ topic, goals, onBack, onSelect }: { topic: StarterTemplate; goals: GoalId[]; onBack: () => void; onSelect: (t: StarterTemplate) => void }) {
  const designs = websiteDesigns(topic.id);
  const showsWork = goals.some((g) => g === "gallery" || g === "video" || g === "audio") || buildStarter(topic.id, "x").pages[0]?.blocks.some((b) => b.type === "gallery");
  const sells = goals.some((g) => g === "bookings" || g === "prices" || g === "shop");
  const best = goals.length === 0 ? [] : showsWork ? designs.filter((d) => d.opening === "gallery") : sells ? designs.filter((d) => d.opening === "stats") : [];
  const rest = designs.filter((d) => !best.includes(d));
  const grid = (list: typeof designs) => (
    <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((d) => (
        <button key={d.id} type="button" onClick={() => onSelect({ ...topic, id: d.templateId, name: `${topic.name} · ${d.name}` })} className={CARD}>
          <Preview template={topic} templateId={d.templateId} goals={goals} action="Start with this" />
          <div className="mt-3.5 flex items-baseline justify-between gap-3">
            <h4 className="min-w-0 truncate text-[17px] font-medium tracking-tight text-neutral-950">{d.name}</h4>
            {topic.includes.length > 0 && <span className="shrink-0 whitespace-nowrap text-xs text-neutral-500">{topic.includes.slice(0, 3).join(" · ")}</span>}
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-neutral-500">{d.feel}</p>
        </button>
      ))}
    </div>
  );

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-neutral-200 pt-6">
        <button type="button" onClick={onBack} className={PILL}>
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <p className="text-base font-medium text-neutral-950">
          {topic.name} · {designs.length} designs
        </p>
        <p className="w-full text-sm text-neutral-500 sm:ml-auto sm:w-auto">Same words and sections, a different site each time: colours, type, banner and what comes first. You can change any of it later under Settings.</p>
      </div>
      {best.length > 0 && (
        <>
          <h3 className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">Made for that · {showsWork ? "your work up front" : "your numbers up front"}</h3>
          <div className="mt-4">{grid(best)}</div>
          <h3 className="mt-14 text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">All designs</h3>
          <div className="mt-4">{grid(rest)}</div>
        </>
      )}
      {best.length === 0 && <div className="mt-8">{grid(designs)}</div>}
    </section>
  );
}

/** The preview is the whole card (`SiteFrame`), with a white pill on hover that says what clicking does. */
function Preview({ template, templateId, goals, action }: { template: StarterTemplate; templateId?: string; goals?: readonly string[]; action: string }) {
  return (
    <div className="relative">
      <SiteFrame template={template} templateId={templateId} goals={goals} />
      <span aria-hidden className="absolute inset-0 grid place-items-center">
        <span className="translate-y-1 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 opacity-0 shadow-lg ring-1 ring-black/10 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          {action}
        </span>
      </span>
    </div>
  );
}

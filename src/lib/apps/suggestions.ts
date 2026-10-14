import { collectConfigCopy } from "@/lib/ai/copy-fields";
import { BLOCK_TYPE_LABELS } from "@/lib/builder/block-defaults";
import { STARTER_TEMPLATES, WEBSITE_TOPICS, buildStarter } from "@/lib/apps/templates";

/**
 * "Next up": the next thing worth fixing on the page, worked out from the page itself, the way an editor's Tab
 * predicts the next edit. The Get live checklist covers setting up; this carries on after it, for as long as the
 * site has template words, template photos or news it isn't telling. Each suggestion is one tap: it opens the
 * section, or hands the AI an instruction for it.
 */
export interface SuggestionBlock {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

export interface SuggestionEvent {
  id: string;
  title: string;
  starts_at: string;
  description: string | null;
  created_at: string;
}

export type SuggestionAction = { kind: "open" } | { kind: "ai"; instruction: string } | { kind: "link"; href: string; label: string };

export interface Suggestion {
  id: string;
  blockId?: string;
  title: string;
  detail: string;
  /** The button's words. */
  action: SuggestionAction & { label: string };
}

const TEMPLATE_PHOTO = /\/templates\/[a-z0-9-]+\.jpg$/;
const SAMPLE_NOTE = /this is a sample|\(sample /i;
/** Short labels ("Get in touch", "Send", "4.9") are fine to keep from the template; only sentences count as stale. */
const LABEL_KEYS = new Set(["button_label", "submit_label", "label", "value", "badge", "name", "success", "title"]);
const isSentence = (key: string, text: string) => text.trim().length >= 12 && !LABEL_KEYS.has(key.split("/").pop() ?? "");
/** Section types whose words the AI can write from the rest of the site; the others need facts only the owner has. */
const AI_WRITABLE = new Set(["hero", "text", "image_text", "faq", "newsletter", "quote", "contact_form", "button"]);

const cache = new Map<string, Set<string>>();

/** Every sentence a starter template ships with, for this app's name: text found here is still the template's. */
export function templateTextSet(appName: string): Set<string> {
  const hit = cache.get(appName);
  if (hit) return hit;
  const set = new Set<string>();
  const ids = [...STARTER_TEMPLATES.map((t) => t.id), ...WEBSITE_TOPICS.map((t) => t.id)];
  for (const id of ids) {
    let starter;
    try {
      starter = buildStarter(id, appName);
    } catch {
      continue;
    }
    for (const page of starter.pages) {
      for (const block of page.blocks) {
        for (const field of collectConfigCopy(block.type, block.config as Record<string, unknown>)) {
          if (field.text.trim().length >= 12) set.add(field.text.trim());
        }
      }
    }
  }
  cache.set(appName, set);
  return set;
}

function weekday(iso: string, now: Date): string {
  const d = new Date(iso);
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  const name = d.toLocaleDateString("en-US", { weekday: "long" });
  return days < 7 ? `on ${name}` : `on ${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`;
}

export function suggestNext(input: { appId: string; appName: string; blocks: SuggestionBlock[]; events: SuggestionEvent[]; now?: Date }): Suggestion[] {
  const now = input.now ?? new Date();
  const out: Suggestion[] = [];
  const template = templateTextSet(input.appName);
  const hero = input.blocks.find((b) => b.type === "hero");
  const label = (b: SuggestionBlock) => BLOCK_TYPE_LABELS[b.type as keyof typeof BLOCK_TYPE_LABELS] ?? b.type;

  // 1. News the site isn't telling: a show added in the last two weeks that the banner doesn't mention.
  const twoWeeksAgo = now.getTime() - 14 * 86_400_000;
  const fresh = input.events
    .filter((e) => new Date(e.starts_at).getTime() > now.getTime() - 6 * 3_600_000 && new Date(e.created_at).getTime() > twoWeeksAgo && !SAMPLE_NOTE.test(e.description ?? ""))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (hero && fresh[0]) {
    const words = collectConfigCopy("hero", hero.config).map((f) => f.text.toLowerCase()).join(" ");
    const title = fresh[0].title.trim();
    if (title && !words.includes(title.toLowerCase())) {
      const when = weekday(fresh[0].starts_at, now);
      out.push({
        id: `event:${fresh[0].id}`,
        blockId: hero.id,
        title: `You added ${title} ${when}`,
        detail: "Want the banner to say so? One line under the headline, nothing else changes.",
        action: { kind: "ai", label: "Mention it in the banner", instruction: `Mention the upcoming event "${title}" (${when}) in one short line in the subtext, keeping the headline and everything else as it is.` },
      });
    }
  }

  // 2. Sample shows still on the calendar.
  const samples = input.events.filter((e) => SAMPLE_NOTE.test(e.description ?? ""));
  if (samples.length) {
    out.push({
      id: "sample-events",
      title: `Your calendar still has ${samples.length === 1 ? "a sample event" : `${samples.length} sample events`}`,
      detail: "They came with the template so the calendar wasn't empty. Replace them with your real dates.",
      action: { kind: "link", label: "Edit events", href: `/dashboard/apps/${input.appId}/events` },
    });
  }

  // 3. Template photos.
  for (const b of input.blocks) {
    const c = b.config;
    if (b.type === "hero") {
      const src = typeof c.image_url === "string" ? c.image_url : "";
      if (!src) out.push({ id: `photo:${b.id}`, blockId: b.id, title: "The banner has no photo yet", detail: "A photo of you or your place is the first thing people see.", action: { kind: "open", label: "Add a photo" } });
      else if (TEMPLATE_PHOTO.test(src)) out.push({ id: `photo:${b.id}`, blockId: b.id, title: "The banner photo is the template's", detail: "Click the photo on the page to replace it with your own.", action: { kind: "open", label: "Replace the photo" } });
    } else if (b.type === "gallery") {
      const images = Array.isArray(c.images) ? (c.images as Array<{ src?: string }>) : [];
      const stock = images.filter((i) => TEMPLATE_PHOTO.test(i.src ?? "")).length;
      if (stock > 0) out.push({ id: `photo:${b.id}`, blockId: b.id, title: `The gallery has ${stock === images.length ? "only" : stock} template photo${stock === 1 ? "" : "s"}`, detail: "Click a photo on the page to replace it, or add yours under Quick updates.", action: { kind: "open", label: "Open the gallery" } });
    } else if ((b.type === "image" || b.type === "image_text") && TEMPLATE_PHOTO.test(typeof c.src === "string" ? c.src : typeof c.image_url === "string" ? c.image_url : "")) {
      out.push({ id: `photo:${b.id}`, blockId: b.id, title: `The ${label(b)} photo is the template's`, detail: "Click it on the page to replace it with your own.", action: { kind: "open", label: "Replace the photo" } });
    }
  }

  // 4. Template words, section by section.
  for (const b of input.blocks) {
    const fields = collectConfigCopy(b.type, b.config).filter((f) => isSentence(f.key, f.text));
    const stale = fields.filter((f) => template.has(f.text.trim()));
    if (stale.length === 0) continue;
    const all = stale.length === fields.length;
    const name = label(b);
    if (AI_WRITABLE.has(b.type)) {
      out.push({
        id: `words:${b.id}`,
        blockId: b.id,
        title: `The ${name} section still has the template's words`,
        detail: all ? "Nothing here is about you yet. The AI can write it from what the rest of the site says." : "Some of it is still the template's. The AI can rewrite those lines from what the rest of the site says.",
        action: { kind: "ai", label: "Write it for me", instruction: "Replace the template's generic words with words about this business, using only what the rest of the site says (its name, what it does, where, its events and products). Keep each field about the same length and keep the tone. Do not invent facts." },
      });
    } else {
      out.push({
        id: `words:${b.id}`,
        blockId: b.id,
        title: `The ${name} section still has the template's ${b.type === "reviews" ? "quotes" : b.type === "hours" ? "hours" : b.type === "stats" ? "numbers" : "details"}`,
        detail: b.type === "reviews" ? "Visitors can tell. Put in two or three real ones, even short." : "Only you know the real ones. It takes a minute.",
        action: { kind: "open", label: "Fill in mine" },
      });
    }
  }

  return out;
}

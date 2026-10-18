import type { Metadata } from "next";
import { pageTitle } from "@/lib/pwa/page-title";
import type { BlockType } from "@/types/database";

/**
 * What a published app tells search engines and link previews, worked out from what the owner already wrote: the
 * page's own SEO fields win, then the app's description, then the first words on the page. Pure functions, so the
 * page, the sitemap and robots.txt agree on one address for every page.
 */

export interface SeoApp {
  name: string;
  custom_domain: string | null;
  custom_domain_status: string | null;
  manifest: { name?: string | null; description?: string | null; icon_url?: string | null };
  theme: { header_tagline?: string | null; header_logo_url?: string | null };
}

export interface SeoPage {
  name: string;
  path: string;
  is_home: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
  share_image_url?: string | null;
}

export interface SeoBlock {
  type: BlockType | string;
  config: unknown;
}

/** The one address search engines should file the app under: its connected domain when it has one, else where it was opened. */
export function canonicalOrigin(app: Pick<SeoApp, "custom_domain" | "custom_domain_status">, host: string | null): string {
  if (app.custom_domain && app.custom_domain_status === "verified") return `https://${app.custom_domain}`;
  const h = host ?? "";
  return `${/localhost|127\.0\.0\.1/.test(h) ? "http" : "https"}://${h}`;
}

/** The home page is "/" (never "/home", which is the same page twice); every other page is "/<path>". */
export function pagePath(page: Pick<SeoPage, "is_home" | "path">): string {
  return page.is_home ? "/" : `/${page.path}`;
}

/** The field of each section that is its heading, in the order the page shows them. */
const HEADING_FIELD: Partial<Record<string, string>> = {
  hero: "headline",
  text: "heading",
  image_text: "heading",
  price_list: "title",
  reviews: "title",
  gallery: "title",
  faq: "title",
  newsletter: "title",
  map: "title",
  product_list: "title",
  event_calendar: "title",
};

/** The first section with words under its heading, in the order a reader meets them. */
const INTRO_FIELD: Partial<Record<string, string>> = {
  hero: "subtext",
  text: "body",
  image_text: "body",
  quote: "quote",
  newsletter: "intro",
  price_list: "subtitle",
};

function field(block: SeoBlock, name: string | undefined): string {
  if (!name) return "";
  const value = (block.config as Record<string, unknown> | null)?.[name];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The index of the section whose heading is the page's one `<h1>`: the first that has a heading. -1 when no section
 * has one, and the page falls back to a hidden heading with its title.
 */
export function firstHeadedBlockIndex(blocks: SeoBlock[]): number {
  return blocks.findIndex((block) => field(block, HEADING_FIELD[block.type]) !== "");
}

/** Rich text (lib/rich-text) as plain words: no bold or italic marks, links keep their words, bullets lose their dash. */
export function plainWords(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The first sentence or so, cut at a word, for a search result. */
export function excerpt(text: string, max = 155): string {
  const words = plainWords(text);
  if (words.length <= max) return words;
  const cut = words.slice(0, max + 1);
  const atWord = cut.lastIndexOf(" ");
  return `${cut.slice(0, atWord > max * 0.6 ? atWord : max).replace(/[,;:\s]+$/, "")}…`;
}

/**
 * One description per page, never the same for two pages: the page's own, else (on the home page) the app's, else
 * the first words on the page, else the page's name with the app's description.
 */
export function pageDescription(app: Pick<SeoApp, "name" | "manifest">, page: Pick<SeoPage, "name" | "is_home" | "seo_description">, blocks: SeoBlock[]): string {
  const own = page.seo_description?.trim();
  if (own) return own;
  const appDescription = app.manifest.description?.trim() ?? "";
  if (page.is_home && appDescription) return appDescription;
  for (const block of blocks) {
    const words = field(block, INTRO_FIELD[block.type]);
    if (words) return excerpt(words);
  }
  const appName = app.manifest.name?.trim() || app.name;
  return appDescription ? `${page.name}: ${excerpt(appDescription, 120)}` : page.is_home ? appName : `${page.name} at ${appName}.`;
}

function absolute(url: string, origin: string): string {
  return /^https?:\/\//i.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** The picture a link to this page shows: the page's own, else one drawn from the app's name and colours. */
export function shareImageUrl(page: Pick<SeoPage, "is_home" | "path" | "share_image_url">, origin: string): string {
  if (page.share_image_url) return absolute(page.share_image_url, origin);
  return `${origin}/share-image${page.is_home ? "" : `?page=${encodeURIComponent(page.path)}`}`;
}

/** Title, description, canonical address and share card for one page of a published app. */
export function publishedPageMetadata(app: SeoApp, page: SeoPage, blocks: SeoBlock[], origin: string): Metadata {
  const title = pageTitle(app, page);
  const description = pageDescription(app, page, blocks);
  const url = `${origin}${pagePath(page)}`;
  const image = shareImageUrl(page, origin);
  const siteName = app.manifest.name?.trim() || app.name;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName, title, description, images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/**
 * Structured data for one page: the site, who runs it, this page, and the questions and answers when the page has a
 * FAQ section. Enough for a search engine to show the site's name and a richer result; nothing that is not on the page.
 */
export function pageJsonLd(app: SeoApp, page: SeoPage, blocks: SeoBlock[], origin: string): Record<string, unknown> {
  const name = app.manifest.name?.trim() || app.name;
  const url = `${origin}${pagePath(page)}`;
  const logo = app.manifest.icon_url?.trim() || app.theme.header_logo_url?.trim() || `${origin}/app-icon?size=512`;
  const graph: Array<Record<string, unknown>> = [
    { "@type": "WebSite", "@id": `${origin}/#website`, url: `${origin}/`, name, publisher: { "@id": `${origin}/#org` } },
    { "@type": "Organization", "@id": `${origin}/#org`, name, url: `${origin}/`, logo: absolute(logo, origin) },
    {
      "@type": "WebPage",
      "@id": url,
      url,
      name: pageTitle(app, page),
      description: pageDescription(app, page, blocks),
      isPartOf: { "@id": `${origin}/#website` },
      primaryImageOfPage: shareImageUrl(page, origin),
    },
  ];
  const questions = blocks
    .filter((block) => block.type === "faq")
    .flatMap((block) => ((block.config as { items?: Array<{ question?: string; answer?: string }> } | null)?.items ?? []))
    .filter((item) => item.question?.trim() && item.answer?.trim());
  if (questions.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: questions.map((q) => ({ "@type": "Question", name: q.question!.trim(), acceptedAnswer: { "@type": "Answer", text: plainWords(q.answer!) } })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

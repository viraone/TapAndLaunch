import type { WebPageBlockConfig } from "@/types/database";

/** How tall the iframe is: the phone screen under the app header and above the tab bar, or a fixed 40rem / 24rem. */
const HEIGHTS: Record<NonNullable<WebPageBlockConfig["height"]>, string> = {
  screen: "h-[calc(100dvh-12rem)] min-h-[24rem]",
  tall: "h-[40rem]",
  short: "h-[24rem]",
};

/**
 * Another website shown inside the app. Some sites refuse to be framed, so a plain link under the iframe always
 * offers a way through. In the builder an empty or non-https address shows a hint; on the live site nothing renders.
 */
export function WebPageBlock({ config, live }: { config: WebPageBlockConfig; live: boolean }) {
  const url = (config.url ?? "").trim();
  if (!url.startsWith("https://")) {
    if (live) return null;
    return (
      <div className="mx-4 my-3 flex h-24 items-center justify-center rounded-2xl border border-dashed px-4 text-center text-sm text-muted-foreground">
        Add a web address starting with https://
      </div>
    );
  }

  return (
    <section className="px-4 py-3 @lg:mx-auto @lg:max-w-3xl @lg:px-8 @lg:py-6">
      <div className="overflow-hidden rounded-2xl bg-muted/30 ring-1 ring-border">
        <iframe
          src={url}
          title={config.title || "Web page"}
          className={`w-full border-0 ${HEIGHTS[config.height ?? "screen"] ?? HEIGHTS.screen}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allow={config.allow_location ? "geolocation" : undefined}
        />
      </div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">
        <a href={url} target="_blank" rel="noopener" className="underline underline-offset-2">
          Open in your browser ↗
        </a>
      </p>
    </section>
  );
}

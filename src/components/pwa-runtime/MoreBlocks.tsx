"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, Link2, MapPin, Share2 } from "lucide-react";
import { EditableImage, EditableText } from "@/components/pwa-runtime/Editable";
import type { AudioBlockConfig, ImageTextBlockConfig, MapBlockConfig, NewsletterBlockConfig, ShareBlockConfig } from "@/types/database";

/** A picture beside words: the picture on the left or the right on a wide screen, stacked on a phone. */
export function ImageTextBlockView({ config, live }: { config: ImageTextBlockConfig; live: boolean }) {
  const label = config.button_label?.trim();
  const href = config.button_url?.trim() ? config.button_url.trim() : config.button_page ? `/${config.button_page}` : undefined;
  const button = label ? (
    <span className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius,9999px)] bg-primary px-5 text-[15px] font-bold text-primary-foreground">
      <EditableText path={["button_label"]} value={config.button_label} placeholder="Button" /> <ArrowRight className="h-4 w-4" />
    </span>
  ) : null;
  return (
    <section className={`px-4 py-6 @lg:mx-auto @lg:flex @lg:max-w-5xl @lg:items-center @lg:gap-10 @lg:px-8 @lg:py-12 ${config.side === "right" ? "@lg:flex-row-reverse" : ""}`}>
      <div className="@lg:w-1/2">
        {config.image_url ? (
          <EditableImage path={["image_url"]} src={config.image_url} alt={config.alt ?? ""} className="aspect-[4/3] w-full rounded-3xl object-cover" imgClassName="h-full w-full object-cover" />
        ) : (
          !live && <div className="flex aspect-[4/3] items-center justify-center rounded-3xl border border-dashed text-sm text-muted-foreground">Add a photo on the right</div>
        )}
      </div>
      <div className="mt-5 @lg:mt-0 @lg:w-1/2">
        <EditableText as="h2" path={["heading"]} value={config.heading} placeholder="Heading" className="text-2xl font-extrabold tracking-tight @lg:text-4xl" />
        <EditableText as="div" path={["body"]} value={config.body} placeholder="A few lines about it" rich className="mt-2 text-[15px] leading-relaxed text-muted-foreground @lg:mt-4 @lg:text-[17px]" />
        {button && (live && href ? <a href={href} target={config.button_url ? "_blank" : undefined} rel={config.button_url ? "noreferrer" : undefined}>{button}</a> : button)}
      </div>
    </section>
  );
}

/** Join the list: an email box that adds the person to the app's members, who the owner can email from Notifications. */
export function NewsletterBlockView({ config, live }: { config: NewsletterBlockConfig; live: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!live) return;
    setStatus("sending");
    try {
      const res = await fetch("/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }
  return (
    <section className="px-4 py-6 @lg:mx-auto @lg:max-w-2xl @lg:px-8 @lg:py-10">
      <div className="rounded-3xl bg-primary/10 p-6 text-center @lg:p-10">
        <EditableText as="h2" path={["title"]} value={config.title} placeholder="Join the mailing list" className="text-2xl font-extrabold tracking-tight @lg:text-3xl" />
        <EditableText as="p" path={["intro"]} value={config.intro} placeholder="A line about what they'll get" className="mt-1 text-sm text-muted-foreground" />
        {status === "done" ? (
          <p className="mt-5 inline-flex items-center gap-2 text-[15px] font-semibold">
            <Check className="h-5 w-5 text-primary" /> <EditableText path={["success"]} value={config.success} fallback="You're on the list." placeholder="You're on the list." />
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 flex flex-col gap-2 @md:flex-row">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pointer-events-auto h-12 flex-1 rounded-[var(--button-radius,9999px)] border border-border bg-background px-5 text-[15px] outline-none focus:ring-2 focus:ring-primary"
            />
            <button type="submit" disabled={status === "sending"} className="inline-flex h-12 items-center justify-center rounded-[var(--button-radius,9999px)] bg-primary px-6 text-[15px] font-bold text-primary-foreground disabled:opacity-60">
              <EditableText path={["button_label"]} value={config.button_label} fallback="Sign up" placeholder="Sign up" />
            </button>
          </form>
        )}
        {status === "error" && <p className="mt-2 text-sm text-destructive">That didn&rsquo;t go through. Try again.</p>}
      </div>
    </section>
  );
}

/** Share this page: copy the link, or open the usual places with it. */
export function ShareBlockView({ config, live }: { config: ShareBlockConfig; live: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" && live ? window.location.href : "";
  const encoded = encodeURIComponent(url);
  const targets = [
    ["X", `https://twitter.com/intent/tweet?url=${encoded}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encoded}`],
    ["WhatsApp", `https://wa.me/?text=${encoded}`],
    ["Email", `mailto:?subject=${encodeURIComponent(document?.title ?? "")}&body=${encoded}`],
  ] as const;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the address is in the bar anyway */
    }
  }
  async function share() {
    if (navigator.share) await navigator.share({ url }).catch(() => {});
    else await copy();
  }
  const pill = "inline-flex min-h-10 items-center gap-1.5 rounded-full bg-muted/60 px-4 text-sm font-semibold ring-1 ring-border transition [&:hover]:bg-muted";
  return (
    <section className="px-4 py-5 @lg:mx-auto @lg:max-w-3xl @lg:px-8 @lg:py-8">
      <EditableText as="h2" path={["title"]} value={config.title} placeholder="Share this" className="text-lg font-bold" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={live ? share : undefined} className={pill}>
          <Share2 className="h-4 w-4 text-primary" /> Share
        </button>
        <button type="button" onClick={live ? copy : undefined} className={pill}>
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-primary" />} {copied ? "Copied" : "Copy link"}
        </button>
        {targets.map(([name, href]) => (
          <a key={name} href={live ? href : undefined} target="_blank" rel="noreferrer" className={pill}>
            <Link2 className="h-4 w-4 text-primary" /> {name}
          </a>
        ))}
      </div>
    </section>
  );
}

/** A map of an address, with a Directions button. Google's embed needs no key for a plain address. */
export function MapBlockView({ config, live }: { config: MapBlockConfig; live: boolean }) {
  const address = config.address?.trim();
  if (!address) {
    return live ? null : <div className="mx-4 my-3 flex h-40 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">Type the address on the right</div>;
  }
  const q = encodeURIComponent(address);
  return (
    <section className="px-4 py-5 @lg:mx-auto @lg:max-w-4xl @lg:px-8 @lg:py-8">
      <EditableText as="h2" path={["title"]} value={config.title} placeholder="Find us" className="mb-3 text-2xl font-extrabold tracking-tight @lg:text-3xl" />
      <div className="overflow-hidden rounded-3xl ring-1 ring-border">
        <iframe title={`Map of ${address}`} src={`https://www.google.com/maps?q=${q}&output=embed`} className="h-64 w-full @lg:h-96" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="flex items-start gap-2 text-[15px]">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <EditableText path={["address"]} value={config.address} placeholder="Address" />
        </p>
        <a href={live ? `https://www.google.com/maps/search/?api=1&query=${q}` : undefined} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--button-radius,9999px)] bg-primary px-4 text-sm font-bold text-primary-foreground">
          Directions
        </a>
      </div>
    </section>
  );
}

/** An audio player: a set, a podcast episode, a song. */
export function AudioBlockView({ config, live }: { config: AudioBlockConfig; live: boolean }) {
  if (!config.src?.trim()) {
    return live ? null : <div className="mx-4 my-3 flex h-24 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">Upload an audio file on the right</div>;
  }
  return (
    <section className="px-4 py-5 @lg:mx-auto @lg:max-w-2xl @lg:px-8 @lg:py-8">
      <div className="rounded-3xl bg-muted/60 p-5 ring-1 ring-border">
        <EditableText as="h3" path={["title"]} value={config.title} placeholder="What this is" className="text-[15px] font-semibold" />
        <EditableText as="p" path={["note"]} value={config.note} placeholder="A line about it (optional)" className="mt-0.5 text-sm text-muted-foreground" />
        <audio controls preload="none" src={config.src} className="pointer-events-auto mt-3 w-full">
          Your browser can&rsquo;t play this.
        </audio>
      </div>
    </section>
  );
}

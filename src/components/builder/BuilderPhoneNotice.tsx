"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, Copy, Laptop } from "lucide-react";

/**
 * The builder is three columns wide, so below the `lg` breakpoint it shows
 * this instead of a layout that runs off the screen. The customer's app
 * itself works fine on phones; only building is a desktop job.
 */
export function BuilderPhoneNotice({ name, live, liveUrl }: { name: string; live: boolean; liveUrl: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the address bar still has the link.
    }
  }

  return (
    <div className="dark relative flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center overflow-hidden bg-neutral-950 px-6 py-12 text-center text-neutral-50 lg:hidden">
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-600/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-indigo-400 to-pink-400 text-neutral-950 shadow-lg shadow-indigo-500/30">
          <Laptop className="h-7 w-7" />
        </span>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight">Build {name} on a computer</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          The builder needs a wide screen to show your blocks, a live preview and the editor side by side. Open this page on a laptop or desktop to
          keep building. Your app already works great on phones.
        </p>

        <div className="mt-8 grid gap-3">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-neutral-950 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_10px_30px_-10px_rgba(129,140,248,0.8)] transition hover:bg-indigo-50"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Link copied" : "Copy this link for your computer"}
          </button>
          {live && liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/15"
            >
              See your live app <ArrowUpRight className="h-4 w-4" />
            </a>
          )}
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-neutral-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to your apps
          </Link>
        </div>
      </div>
    </div>
  );
}

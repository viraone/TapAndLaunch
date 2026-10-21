"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";
import { priceLabel } from "@/lib/domains/buy";
import { withNext } from "@/lib/auth/next-path";

interface Offer {
  domain: string;
  available: boolean;
  priceCents: number | null;
  renewCents: number | null;
}

/**
 * The search box and results of tapandlaunch.com/domains. Searching needs no account. Buying sends a visitor to sign
 * up (and back here afterwards), and a signed-in admin straight to Stripe; the dashboard's Domains page takes over
 * when they return.
 */
export function DomainSearch({ initialQuery, signedIn, available }: { initialQuery: string; signedIn: boolean; available: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [searched, setSearched] = useState(initialQuery.trim());
  const [offers, setOffers] = useState<Offer[] | null>(null);
  // "Checking…" from the moment a term is set (a shared `?q=` link starts checking at once) until the answer lands.
  const [searching, setSearching] = useState(!!initialQuery.trim() && available);
  const [problem, setProblem] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  // One request per searched term: typing changes `query`, the form sets `searched` (and the address, so the result
  // can be shared or come back to after signing up).
  useEffect(() => {
    if (!searched || !available) return;
    let cancelled = false;
    fetch(`/api/domains/search?q=${encodeURIComponent(searched)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setOffers(null);
          setProblem(body.error ?? "Search failed. Try again.");
        } else {
          setProblem(null);
          setOffers(body.offers ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setProblem("Couldn't reach the server. Check your connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [searched, available]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    window.history.replaceState(null, "", `/domains?q=${encodeURIComponent(term)}`);
    if (term !== searched) setSearching(true);
    setSearched(term);
  }

  async function handleBuy(domain: string) {
    const back = `/domains?q=${encodeURIComponent(searched)}`;
    if (!signedIn) {
      router.push(withNext("/signup", back));
      return;
    }
    setBuying(domain);
    try {
      const res = await fetch("/api/domains/buy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.url) {
        window.location.assign(body.url);
        return;
      }
      if (body.signIn) router.push(withNext("/login", back));
      else if (body.needsOnboarding) router.push(withNext("/onboarding", back));
      else toast.error(body.error ?? "Couldn't start the purchase");
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBuying(null);
    }
  }

  return (
    <section aria-label="Domain search" className="mt-10">
      <form onSubmit={handleSearch} className="flex max-w-3xl flex-col gap-3 sm:flex-row">
        <label htmlFor="domain-query" className="sr-only">
          Domain name
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            id="domain-query"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={100}
            placeholder="costumecontestsseattle, or the words of your name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-14 w-full rounded-full border border-neutral-300 bg-white pl-13 pr-5 text-lg text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/10"
            style={{ paddingLeft: "3.25rem" }}
          />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim() || !available}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-neutral-950 px-7 text-base font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {searching ? "Checking…" : "Search"}
        </button>
      </form>

      {!available && (
        <p role="status" className="mt-4 max-w-xl rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Domain search isn&rsquo;t available right now. Try again a little later.
        </p>
      )}

      {problem && (
        <p role="alert" className="mt-4 max-w-xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {problem}
        </p>
      )}

      {offers && (
        <ul className="mt-8 max-w-3xl divide-y divide-neutral-200 border-y border-neutral-200">
          {offers.map((o) => (
            <li key={o.domain} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
              <div className="min-w-0">
                <p className={`truncate text-xl font-medium tracking-tight ${o.available ? "" : "text-neutral-400 line-through decoration-neutral-300"}`}>{o.domain}</p>
                <p className="mt-1 text-sm text-neutral-600">
                  {o.available && o.priceCents != null && o.renewCents != null ? priceLabel(o.priceCents, o.renewCents) : "Taken"}
                </p>
              </div>
              {o.available && (
                <button
                  type="button"
                  disabled={!!buying}
                  onClick={() => void handleBuy(o.domain)}
                  className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 px-6 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(99,102,241,0.6)] transition hover:brightness-110 disabled:opacity-60"
                >
                  {buying === o.domain ? "Opening checkout…" : signedIn ? "Buy" : "Sign up and buy"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </li>
          ))}
          {offers.length === 0 && <li className="py-5 text-sm text-neutral-600">Nothing to show for that. Try other words.</li>}
        </ul>
      )}
      {offers && offers.some((o) => o.available) && (
        <p className="mt-4 max-w-3xl text-sm text-neutral-500">
          Prices come straight from the registrar and are for one year, with privacy included. You&rsquo;ll see the exact amount again on the payment page
          before anything is charged.
        </p>
      )}
    </section>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedApp } from "@/lib/pwa/data";
import { ReportForm } from "./ReportForm";

type Params = Promise<{ appSlug: string }>;

export const metadata: Metadata = { title: "Report this app", robots: { index: false } };

/** Anyone can report a published app to TapAndLaunch (linked from every AI-written app, outside the app's own code). */
export default async function ReportPage({ params }: { params: Params }) {
  const { appSlug } = await params;
  const published = await getPublishedApp(appSlug);
  if (!published) notFound();
  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-white px-5 py-10 font-sans text-slate-900">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium text-slate-500 hover:text-slate-900">
        ← Back to {published.app.name}
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Report this app</h1>
      <p className="mt-2 text-slate-600">
        {published.app.name} was made with TapAndLaunch by one of its customers. If something about it is wrong or harmful, tell us and we&apos;ll look into it.
      </p>
      <ReportForm />
    </main>
  );
}

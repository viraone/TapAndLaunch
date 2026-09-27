import Link from "next/link";
import { MemberAuthForm } from "@/components/pwa-runtime/MemberAuthForm";

type SearchParams = Promise<{ next?: string }>;

export default async function MemberLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-sm flex-1 p-6">
      <h1 className="mb-4 text-lg font-semibold">Sign in</h1>
      <MemberAuthForm mode="login" next={next ?? "/"} />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href={`/members/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}

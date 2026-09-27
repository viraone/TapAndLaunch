import Link from "next/link";
import { MemberAuthForm } from "@/components/pwa-runtime/MemberAuthForm";

type SearchParams = Promise<{ next?: string }>;

export default async function MemberSignupPage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-sm flex-1 p-6">
      <h1 className="mb-4 text-lg font-semibold">Create an account</h1>
      <MemberAuthForm mode="signup" next={next ?? "/"} />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/members/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

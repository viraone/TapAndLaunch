import Link from "next/link";

/**
 * What a visitor sees at an app address that isn't being served: the app isn't published (yet, or any more) or the
 * address is wrong. One page for both on purpose, so the address alone doesn't reveal whether a draft exists.
 */
export default function AppNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold">This app isn&apos;t published right now</h1>
      <p className="text-sm text-muted-foreground">It may not be live yet, or the address may be mistyped. Check the link you were given.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Your app? Open it in{" "}
        <Link href="https://tapandlaunch.com/dashboard" className="font-medium underline">
          TapAndLaunch
        </Link>{" "}
        and click Publish.
      </p>
    </main>
  );
}

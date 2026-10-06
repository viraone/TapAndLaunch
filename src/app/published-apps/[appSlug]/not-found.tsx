/** A page address that isn't part of this (published) app. Rendered inside the app's own header and navigation. */
export default function AppPageNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <h1 className="text-lg font-semibold">This page isn&apos;t here</h1>
      <p className="text-sm text-muted-foreground">Use the app&apos;s menu to find what you&apos;re after.</p>
    </main>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Beezer</h1>
        <p className="max-w-md text-muted-foreground">
          Build and publish progressive web apps without code. This is the Phase 1 scaffold — see
          the README for what&rsquo;s built and what&rsquo;s deferred.
        </p>
      </div>
      <div className="flex gap-3">
        {/* This UI kit is Base UI, not Radix — polymorphic composition is a
            `render` prop, not `asChild`. */}
        <Button render={<Link href="/signup">Get started</Link>} />
        <Button variant="outline" render={<Link href="/login">Log in</Link>} />
      </div>
    </div>
  );
}

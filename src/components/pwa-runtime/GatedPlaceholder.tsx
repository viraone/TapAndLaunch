import Link from "next/link";
import { Lock } from "lucide-react";

/**
 * Rendered in place of a block the current visitor doesn't have the tier
 * for — never the block's own content, config, or type, so a locked block
 * doesn't leak what it contains.
 */
export function GatedPlaceholder({ signedIn, next }: { signedIn: boolean; next: string }) {
  return (
    <div className="mx-4 my-2 flex flex-col items-center gap-2 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      <Lock className="h-5 w-5" />
      {signedIn ? (
        <p>This content isn&rsquo;t available on your current plan.</p>
      ) : (
        <>
          <p>Sign in to view this content.</p>
          <Link href={`/members/login?next=${encodeURIComponent(next)}`} className="font-medium text-primary underline">
            Sign in
          </Link>
        </>
      )}
    </div>
  );
}

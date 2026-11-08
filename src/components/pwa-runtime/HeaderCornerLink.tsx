"use client";

import Link from "next/link";
import { initialsOf, shortName, useSignedInName } from "@/lib/openmic/signed-in-name";
import { TabIcon } from "./BottomNav";

/**
 * The app header's corner link. Signed out it is a round icon button; once an app's sign-in reports a name
 * (StageTime's comics and hosts) the icon becomes the person's initials with their first name underneath,
 * so "who am I signed in as" lives in the same spot as the way to the profile.
 */
export function HeaderCornerLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const name = useSignedInName();
  if (!name) {
    return (
      <Link
        href={href}
        aria-label={label}
        title={label}
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground ring-1 ring-border/70 transition active:scale-95 active:bg-foreground/10"
      >
        <TabIcon name={icon} />
      </Link>
    );
  }
  return (
    <Link
      href={href}
      aria-label={`Signed in as ${name}. ${label}`}
      title={`Signed in as ${name}`}
      className="ml-auto flex w-14 shrink-0 flex-col items-center gap-1 transition active:scale-95"
    >
      <span
        aria-hidden
        className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-primary/40 to-primary/15 text-[15px] font-semibold text-primary ring-1 ring-primary/30"
      >
        {initialsOf(name)}
      </span>
      <span aria-hidden className="w-full truncate text-center text-[12px] font-semibold leading-none text-muted-foreground">
        {shortName(name)}
      </span>
    </Link>
  );
}

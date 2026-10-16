/** `Maple Street Bakery` -> `maple-street-bakery`: lowercase letters, numbers and hyphens, at most 63 characters. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // "é" is "e" plus an accent mark: drop the mark, keep the letter
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
}

/** A neutral address with a random tail (`app-x7f3a2`), for a name that has nothing to make an address from. */
export function randomAddress(prefix = "workspace", random: () => number = Math.random): string {
  return `${prefix}-${random().toString(36).slice(2, 8).padEnd(6, "0")}`;
}

/**
 * The web address to send for a name. A name with no letters or digits that we can read (日本語, emoji, "!!!") has
 * nothing to make an address from, so it gets `fallback` instead of an error the person cannot act on. A screen that
 * shows the address before it is saved passes the same fallback to both, so what was shown is what is used.
 */
export function addressFor(name: string, fallback: string = randomAddress()): string {
  return slugify(name) || fallback;
}

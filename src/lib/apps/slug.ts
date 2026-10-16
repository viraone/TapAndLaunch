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

/**
 * The web address to send for an organization name. A name with no letters or digits that we can read (日本語, emoji,
 * "!!!") has nothing to make an address from, so it gets a neutral one with a random tail instead of an error the
 * person cannot act on. The address is only an internal handle for the organization.
 */
export function addressFor(name: string, random: () => number = Math.random): string {
  return slugify(name) || `workspace-${random().toString(36).slice(2, 8).padEnd(6, "0")}`;
}

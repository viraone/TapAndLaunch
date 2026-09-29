const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function listingSlug(id: unknown): string {
  return String(id ?? "").trim().toLowerCase();
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function listingsToSql(records: unknown, appId: string): string {
  if (!UUID_RE.test(appId)) throw new Error("app id must be a uuid");
  if (!Array.isArray(records)) throw new Error("records must be an array");
  if (records.length === 0) throw new Error("no records");

  const seen = new Set<string>();
  const lines: string[] = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record === null || Array.isArray(record) || typeof record !== "object") {
      throw new Error(`record ${i} is not an object`);
    }
    const slug = listingSlug((record as Record<string, unknown>)["id"]);
    if (slug === "") throw new Error(`record ${i} has no id`);
    if (seen.has(slug)) throw new Error(`duplicate id: ${slug}`);
    seen.add(slug);
    lines.push(`  (${quote(appId)}, ${quote(slug)}, ${quote(JSON.stringify(record))}::jsonb)`);
  }

  return [
    "begin;",
    "insert into public.listings (app_id, slug, record) values",
    lines.join(",\n"),
    "on conflict (app_id, slug) do update set record = excluded.record;",
    "commit;",
  ].join("\n") + "\n";
}

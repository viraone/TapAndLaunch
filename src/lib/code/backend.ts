import type { CodeFiles } from "./files";

/**
 * An AI-written app's own database: the owner's Supabase project. The app's code talks to it straight from the visitor's
 * browser with the project's public key, so the owner's row-level security rules are what protect their data. The AI
 * writes the table setup as `db/NNN_name.sql` files, which the owner runs in their own SQL editor.
 */

/** The ready-made client the AI imports (`import { supabase } from '@/lib/supabase'`). Written by us, never by the AI. */
export const SUPABASE_PATH = "src/lib/supabase.js";

/** Database setup files: `db/001_tasks.sql`. Not part of the app that runs; shown in the builder to be run by the owner. */
export const SQL_FILE = /^db\/[0-9]{3}_[a-z0-9_]{1,50}\.sql$/;

export interface BackendInfo {
  url: string;
  anonKey: string;
}

/** Cleans and checks what the owner pasted. Returns an error to show, or the cleaned values. */
export function checkBackendInput(rawUrl: string, rawKey: string): { error: string } | BackendInfo {
  const url = rawUrl.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const key = rawKey.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "That doesn't look like a Project URL. It looks like https://abcdefgh.supabase.co" };
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(local && process.env.NODE_ENV !== "production")) {
    return { error: "The Project URL must start with https://" };
  }
  if (parsed.pathname !== "/" && parsed.pathname !== "") return { error: "Paste just the Project URL, like https://abcdefgh.supabase.co" };
  // Our server checks the connection by calling this address, so on the live site it must be a real Supabase project
  // (never an internal address). Locally, the Supabase running on this computer is allowed too.
  if (!/^[a-z0-9]{10,40}\.supabase\.co$/.test(parsed.hostname) && !(local && process.env.NODE_ENV !== "production")) {
    return { error: "Paste your Supabase Project URL. It looks like https://abcdefgh.supabase.co" };
  }
  if (!key) return { error: "Paste the project's public (anon) key." };
  // The secret key bypasses every rule in the owner's database. It must never reach a browser.
  if (key.startsWith("sb_secret_") || jwtRole(key) === "service_role") {
    return { error: "That's the secret (service role) key. Never share it. Paste the public anon / publishable key instead." };
  }
  if (!key.startsWith("sb_publishable_") && jwtRole(key) !== "anon") {
    return { error: "That doesn't look like the public key. In Supabase: Project Settings > API Keys, copy the anon / publishable key." };
  }
  return { url: `${parsed.protocol}//${parsed.host}`, anonKey: key };
}

/** The role inside a legacy JWT-style Supabase key (`anon` or `service_role`), or null if it isn't one. */
function jwtRole(key: string): string | null {
  const part = key.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { role?: string };
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

/** The project's id from a hosted Supabase URL (`https://abcd.supabase.co` -> `abcd`), for links to its dashboard. */
export function projectRef(url: string): string | null {
  const m = /^https:\/\/([a-z0-9]{10,40})\.supabase\.co$/.exec(url);
  return m ? (m[1] as string) : null;
}

/** Where the owner pastes and runs SQL for this project. */
export function sqlEditorUrl(url: string): string | null {
  const ref = projectRef(url);
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : null;
}

/** The ready-made client file. Sign-ins are kept by the page around the app (see the runtime's storage bridge). */
export function supabaseFile(backend: BackendInfo): string {
  return `import { createClient } from '@supabase/supabase-js';

// This app's database and sign-in (the owner's own Supabase project). Ready-made: use it, don't change it.
// The public key is meant to be shared; the project's row-level security rules decide what it can do.
export const supabase = createClient(${JSON.stringify(backend.url)}, ${JSON.stringify(backend.anonKey)}, {
  auth: { storage: window.__tlStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
`;
}

/** A short, stable fingerprint of a setup file's text, to tell whether the owner ran this version of it. */
export function sqlHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** The setup files in the order they should be run, and whether each has been run in its current form. */
export function sqlFiles(files: CodeFiles, applied: Record<string, string>): Array<{ path: string; sql: string; ran: boolean; changed: boolean }> {
  return Object.keys(files)
    .filter((p) => SQL_FILE.test(p))
    .sort()
    .map((path) => {
      const sql = files[path] as string;
      const mark = applied[path];
      return { path, sql, ran: mark === sqlHash(sql), changed: mark !== undefined && mark !== sqlHash(sql) };
    });
}

/** What the AI is told when the app has a database connected. */
export function backendRules(files: CodeFiles): string {
  const existing = Object.keys(files).filter((p) => SQL_FILE.test(p)).sort();
  const next = String(existing.length + 1).padStart(3, "0");
  return `THIS APP HAS A REAL DATABASE AND SIGN-IN (the owner's own Supabase project). Use them instead of sample data in React state for anything that should be saved.
- Import the ready-made client: \`import { supabase } from '@/lib/supabase'\`. It already exists; never write or change src/lib/supabase.js, and never use any other key.
- Tables: write the SQL in a NEW file \`db/${next}_short_name.sql\` (${existing.length ? `files already there: ${existing.join(", ")}; never edit those, they may have been run already. Add a new numbered file for any change` : "this is the first one"}). The owner runs it in their Supabase SQL editor. Use \`create table if not exists public.name (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), ...)\`. For data that belongs to a signed-in person add \`user_id uuid not null default auth.uid() references auth.users(id) on delete cascade\`.
- ALWAYS enable row level security on every table (\`alter table public.name enable row level security;\`) and add policies, for example: anyone may read public things (\`for select using (true)\`), signed-in people manage only their own rows (\`using (user_id = auth.uid())\` and \`with check (user_id = auth.uid())\`). A few starter rows may be inserted in the SQL.
- Reading and saving: \`const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })\`, \`.insert({...}).select()\`, \`.update({...}).eq('id', id)\`, \`.delete().eq('id', id)\`. Show loading, empty and error states. If an error says a table doesn't exist (code 42P01 or PGRST205), show a friendly card: "Your database isn't set up yet. In the builder, open Database and run the setup."
- Sign-in: email and password only (\`supabase.auth.signUp\`, \`signInWithPassword\`, \`signOut\`; follow \`supabase.auth.getSession()\` and \`onAuthStateChange\`). No magic links or social sign-in (they need redirects this app can't use). After sign-up, if there's no session yet, say "Check your email to confirm, then sign in."`;
}

/**
 * Checks the project and key work by reading the project's public sign-in settings (what any browser can read with the
 * public key). Returns an error to show, or whether new sign-ups must confirm their email first.
 */
export async function verifyBackend(backend: BackendInfo): Promise<{ error: string } | { confirmEmail: boolean }> {
  try {
    const res = await fetch(`${backend.url}/auth/v1/settings`, { headers: { apikey: backend.anonKey }, redirect: "error", signal: AbortSignal.timeout(8000) });
    if (res.status === 401 || res.status === 403) return { error: "Supabase didn't accept that key for this project. Check you copied the anon / publishable key of the same project." };
    if (!res.ok) return { error: `Couldn't reach that Supabase project (it answered ${res.status}). Check the Project URL.` };
    const settings = (await res.json().catch(() => ({}))) as { mailer_autoconfirm?: boolean; external?: { email?: boolean } };
    if (settings.external?.email === false) return { error: "Email sign-in is turned off in this project. Turn it on in Supabase: Authentication > Sign In / Providers > Email." };
    return { confirmEmail: settings.mailer_autoconfirm !== true };
  } catch {
    return { error: "Couldn't reach that Supabase project. Check the Project URL." };
  }
}

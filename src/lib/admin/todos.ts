import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const TZ = "America/Los_Angeles";

export interface SeededTodo {
  key: string;
  section: string;
  title: string;
  detail?: string;
  /** The steps to follow, each with its own tick. The last one ticked finishes the item. */
  steps?: Array<{ title: string; detail?: string }>;
}

export interface TodoStep {
  id: string;
  title: string;
  detail: string | null;
  done: boolean;
}

export interface TodoItem {
  id: string;
  key: string | null;
  title: string;
  detail: string | null;
  section: string;
  done: boolean;
  steps: TodoStep[];
}

/**
 * One admin board's to-do list. Items the code knows about are upserted by key, so their wording and order follow the code
 * while their ticks are kept; the admin's own items have no key. Returns what the board shows: everything open, plus what
 * was ticked today (it drops off tomorrow), and how many were ticked before today.
 */
export async function loadBoardTodos(admin: SupabaseClient<Database>, board: string, seeded: SeededTodo[]): Promise<{ todos: TodoItem[]; doneEarlier: number }> {
  if (seeded.length) {
    const { data: parents } = await admin
      .from("admin_todos")
      .upsert(seeded.map((s, i) => ({ key: s.key, board, section: s.section, title: s.title, detail: s.detail ?? null, sort: i })), { onConflict: "key" })
      .select("id, key");
    const idByKey = new Map((parents ?? []).map((r) => [r.key as string, r.id]));
    const steps = seeded
      .flatMap((s) => (s.steps ?? []).map((st, i) => ({ key: `${s.key}/${i + 1}`, board, parent_id: idByKey.get(s.key) ?? null, section: s.section, title: st.title, detail: st.detail ?? null, sort: i })))
      .filter((st) => st.parent_id);
    if (steps.length) await admin.from("admin_todos").upsert(steps, { onConflict: "key" });
  }

  const { data: rows } = await admin.from("admin_todos").select("id, key, title, detail, section, done_at, parent_id").eq("board", board).order("sort").order("created_at");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const dateOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
  // Items the code seeds are shown only while this board's code still lists them (one dropped from the code, or moved to
  // another board, disappears here without touching its row); items the admin typed in are always shown.
  const owned = new Set(seeded.map((s) => s.key));
  const all = (rows ?? []).filter((r) => !r.key || owned.has(r.key) || r.parent_id);
  const items = all.filter((r) => !r.parent_id);
  const todos = items
    .filter((r) => !r.done_at || dateOf(r.done_at) === today)
    .map((r) => ({
      id: r.id,
      key: r.key,
      title: r.title,
      detail: r.detail,
      section: r.section,
      done: !!r.done_at,
      steps: all.filter((s) => s.parent_id === r.id).map((s) => ({ id: s.id, title: s.title, detail: s.detail, done: !!s.done_at })),
    }));
  return { todos, doneEarlier: items.filter((r) => r.done_at && dateOf(r.done_at) !== today).length };
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LocalTime } from "@/components/dashboard/LocalTime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/types/database";

type OrderNote = Database["public"]["Tables"]["order_notes"]["Row"];

export function OrderNotes({
  appId,
  orderId,
  notes,
}: {
  appId: string;
  orderId: string;
  notes: OrderNote[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || body.trim() === "") return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/orders/${orderId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not add the note.");
        return;
      }
      setBody("");
      router.refresh();
    } catch {
      setError("Could not add the note.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!window.confirm("Delete this note?")) return;

    setDeletingId(noteId);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/orders/${orderId}/notes/${noteId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not delete the note.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not delete the note.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notes yet. Notes are internal and never shown to customers.
          </p>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-md border p-3">
                <div className="mb-1 flex items-start justify-between gap-3 text-xs text-muted-foreground">
                  <p>
                    {note.author_email ?? "Unknown author"} · <LocalTime iso={note.created_at} />
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={saving || deletingId !== null}
                    onClick={() => deleteNote(note.id)}
                  >
                    {deletingId === note.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{note.body}</p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addNote} className="space-y-2">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={2000}
            placeholder="Add an internal note"
            disabled={saving}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving || body.trim() === ""}>
            {saving ? "Adding..." : "Add note"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

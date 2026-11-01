"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MAX_TAG_LENGTH, MAX_TAGS, normalizeTag } from "@/lib/orders/tags";

export function OrderTags({
  appId,
  orderId,
  tags: initialTags,
}: {
  appId: string;
  orderId: string;
  tags: string[];
}) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string[]): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/orders/${orderId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not save the tags.");
        return false;
      }
      setTags(Array.isArray(data?.tags) ? data.tags : next);
      router.refresh();
      return true;
    } catch {
      setError("Could not save the tags.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addTag() {
    const tag = normalizeTag(input);
    if (tag === null) {
      setError(input.trim() === "" ? null : `Tags are up to ${MAX_TAG_LENGTH} characters.`);
      return;
    }
    if (tags.includes(tag)) {
      setInput("");
      setError(null);
      return;
    }
    if (tags.length >= MAX_TAGS) {
      setError(`You can add up to ${MAX_TAGS} tags.`);
      return;
    }

    if (await save([...tags, tag])) setInput("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      void addTag();
    }
  }

  function removeTag(tag: string) {
    void save(tags.filter((value) => value !== tag));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  className="rounded-full hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                  disabled={saving}
                  onClick={() => removeTag(tag)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a tag"
          disabled={saving || tags.length >= MAX_TAGS}
          className="max-w-xs"
        />
        <p className="text-xs text-muted-foreground">Up to {MAX_TAGS} tags</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

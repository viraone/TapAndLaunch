"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NotificationChannel } from "@/types/database";

type ChannelAvailability = Record<NotificationChannel, boolean>;

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  push: "Web push",
  email: "Email",
  sms: "SMS",
};

export function ComposeForm({ appId, channelsConfigured }: { appId: string; channelsConfigured: ChannelAvailability }) {
  const router = useRouter();
  const [channel, setChannel] = useState<NotificationChannel>(
    (Object.keys(channelsConfigured) as NotificationChannel[]).find((c) => channelsConfigured[c]) ?? "push"
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [audience, setAudience] = useState<"all" | "tier">("all");
  const [tier, setTier] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch(`/api/apps/${appId}/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          title,
          body,
          url: channel === "push" ? url : undefined,
          target: audience === "all" ? { type: "all" } : { type: "tier", tier },
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? "Failed to send");
        return;
      }
      toast.success(`Sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}${result.failed ? ` (${result.failed} failed)` : ""}`);
      setTitle("");
      setBody("");
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label>Channel</Label>
        <Select value={channel} onValueChange={(value) => setChannel(value as NotificationChannel)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CHANNEL_LABELS) as NotificationChannel[]).map((c) => (
              <SelectItem key={c} value={c} disabled={!channelsConfigured[c]}>
                {CHANNEL_LABELS[c]}
                {!channelsConfigured[c] ? " (not configured)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Audience</Label>
        <div className="flex items-center gap-2">
          <Select value={audience} onValueChange={(value) => setAudience(value as "all" | "tier")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="tier">Specific tier</SelectItem>
            </SelectContent>
          </Select>
          {audience === "tier" && (
            <Input placeholder="e.g. premium" value={tier} onChange={(e) => setTier(e.target.value)} className="w-40" />
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="notif-title">Title</Label>
        <Input id="notif-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="notif-body">Message</Label>
        <Textarea id="notif-body" required rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      {channel === "push" && (
        <div className="space-y-1">
          <Label htmlFor="notif-url">Opens (in-app path)</Label>
          <Input id="notif-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/" />
        </div>
      )}

      <Button type="submit" disabled={sending || !channelsConfigured[channel] || (audience === "tier" && !tier)}>
        {sending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}

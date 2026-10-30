import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { GroupChatBlockConfig } from "@/types/database";
import { linked } from "@/lib/builder/field-link";

/**
 * The group chat's public words only. Who may read and post is the app's server-side allowlist
 * (`group_chat_members`), which is never part of a block's config — so this editor deliberately has no name list or
 * member picker to leak into the public page.
 */
export function GroupChatBlockEditor({ config, onChange }: { config: GroupChatBlockConfig; onChange: (c: GroupChatBlockConfig) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="group-chat-title">Title</Label>
        <Input
          id="group-chat-title"
          {...linked("title")}
          value={config.title ?? ""}
          maxLength={60}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="group-chat-intro">A line under the title (optional)</Label>
        <Textarea
          id="group-chat-intro"
          {...linked("intro")}
          rows={2}
          value={config.intro ?? ""}
          maxLength={200}
          onChange={(e) => onChange({ ...config, intro: e.target.value })}
        />
      </div>
      <p className="rounded-xl bg-white/[0.04] p-3 text-xs leading-relaxed text-neutral-300 ring-1 ring-white/10">
        Only people on this app&apos;s chat list can see the messages. The list lives on the server, so it isn&apos;t
        shown or edited here.
      </p>
    </div>
  );
}

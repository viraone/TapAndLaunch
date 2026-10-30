"use client";

import type { GroupChatBlockConfig } from "@/types/database";
import { EditableText } from "@/components/pwa-runtime/Editable";

/**
 * The builder's preview of a group chat. It shows the public words only — the title and the line above the chat —
 * because the chat itself needs a signed-in member and the class list lives on the server, never in this block's
 * config. On the published app, BlockRenderer swaps in GroupChatRuntime.
 */
export function GroupChatBlockView({ config }: { config: GroupChatBlockConfig }) {
  return (
    <section className="px-4 py-5">
      <EditableText as="h2" path={["title"]} value={config.title} placeholder="Group chat" className="text-lg font-semibold" />
      <EditableText
        as="p"
        path={["intro"]}
        value={config.intro}
        placeholder="Only people on the list can see this."
        className="mt-1 text-sm text-muted-foreground"
      />
      <p className="mt-3 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        A private chat for the people on your list. After they sign in with the email you have for them, they can read
        and send messages here. The list itself lives on the server, so it isn&apos;t shown or edited in the builder.
      </p>
    </section>
  );
}

"use client";

import { useState } from "react";
import { findMentions, splitMentions, type ChatPerson } from "@/lib/chat/mentions";

/**
 * The group chat's bubbles, day separators and name-and-time runs. Borrows the look of StageTime's chat thread
 * (OpenMicChatThread.tsx) but is its own text-only component: no photos, and the only extra mark is the Teacher
 * badge. The server sends `mine` per message, so another member's account id never reaches this component.
 */

export interface GroupChatMessage {
  id: number;
  created_at: string;
  author_name: string;
  author_role: "student" | "teacher";
  body: string;
  mine: boolean;
}

/** Messages from one person within this many minutes share one name-and-time label. */
const RUN_MINUTES = 5;

export function GroupChatMessageList({
  messages,
  timeZone,
  people,
  viewerName,
}: {
  messages: GroupChatMessage[];
  timeZone: string;
  /** Everyone on the class list, so @names can be highlighted; the viewer is included. */
  people?: ChatPerson[];
  /** The signed-in viewer's display name, used to single out a mention of themselves. */
  viewerName?: string;
}) {
  const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const time = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const [now] = useState(() => Date.now());
  const today = day(new Date(now).toISOString());
  const yesterday = day(new Date(now - 86_400_000).toISOString());
  const dayLabel = (iso: string) => {
    const d = day(iso);
    if (d === today) return "Today";
    if (d === yesterday) return "Yesterday";
    return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
  };

  return (
    <ol className="flex flex-col gap-1">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || day(prev.created_at) !== day(m.created_at);
        const newRun =
          newDay ||
          prev.author_name !== m.author_name ||
          prev.author_role !== m.author_role ||
          new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > RUN_MINUTES * 60_000;
        const teacher = m.author_role === "teacher";
        const parts = splitMentions(m.body, people ?? []);
        const viewerKey = viewerName?.toLowerCase();
        const mentionClassName = (text: string) => {
          const own = viewerKey !== undefined && findMentions(text, people ?? []).some((name) => name.toLowerCase() === viewerKey);
          // On my own purple bubble the mention needs weight and an underline; the highlight is the light foreground
          // colour so it stays visible there. On the grey bubble primary text and a soft primary wash read best.
          if (m.mine) return `font-semibold underline${own ? " rounded bg-primary-foreground/20 px-0.5" : ""}`;
          return `font-semibold text-primary${own ? " rounded bg-primary/20 px-0.5" : ""}`;
        };
        return (
          <li key={m.id} className="flex flex-col">
            {newDay && <p className="my-3 text-center text-[13px] font-semibold text-muted-foreground">{dayLabel(m.created_at)}</p>}
            {newRun && (
              <p className={`mb-0.5 mt-2 px-1 text-[13px] text-muted-foreground ${m.mine ? "text-right" : ""}`}>
                {m.mine ? (
                  <>
                    {teacher && <span className="mr-1.5 font-semibold text-primary">Teacher</span>}
                    {time(m.created_at)}
                  </>
                ) : (
                  <>
                    {m.author_name}
                    {teacher && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary">
                        Teacher
                      </span>
                    )}
                    {" · "}
                    {time(m.created_at)}
                  </>
                )}
              </p>
            )}
            <div
              className={`max-w-[80%] overflow-hidden rounded-2xl ${
                m.mine ? "ml-auto rounded-br-md bg-primary text-primary-foreground" : "mr-auto rounded-bl-md bg-muted text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap break-words px-3.5 py-2 text-[17px] leading-snug">
                {parts.map((part, index) =>
                  part.mention ? (
                    <span key={index} className={mentionClassName(part.text)}>
                      {part.text}
                    </span>
                  ) : (
                    <span key={index}>{part.text}</span>
                  )
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

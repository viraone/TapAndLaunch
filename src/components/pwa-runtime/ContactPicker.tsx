"use client";

import { useMemo, useState } from "react";
import type { AutomationContact, AutomationRecipient } from "@/lib/automation/ui";
import { filterContacts } from "@/lib/automation/ui";
import { AutomationDialog } from "./AutomationDialog";

/**
 * The owner's Gmail contacts as a searchable checklist. People already on the reminder start ticked; "Add N" adds
 * the newly ticked ones and leaves the rest alone.
 */
export function ContactPicker({
  contacts,
  chosen,
  onAdd,
  onClose,
}: {
  contacts: AutomationContact[];
  chosen: AutomationRecipient[];
  onAdd: (additions: AutomationContact[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(chosen.map((recipient) => recipient.email.trim().toLowerCase()))
  );

  const shown = useMemo(() => filterContacts(contacts, query), [contacts, query]);
  const chosenEmails = useMemo(
    () => new Set(chosen.map((recipient) => recipient.email.trim().toLowerCase())),
    [chosen]
  );
  const additions = contacts.filter((contact) => {
    const email = contact.email.trim().toLowerCase();
    return picked.has(email) && !chosenEmails.has(email);
  });

  function toggle(email: string) {
    const key = email.trim().toLowerCase();
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllShown() {
    setPicked((previous) => {
      const next = new Set(previous);
      for (const contact of shown) next.add(contact.email.trim().toLowerCase());
      return next;
    });
  }

  return (
    <AutomationDialog
      title="Choose from my Gmail contacts"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border bg-muted px-4 text-base font-semibold"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => {
              onAdd(additions);
              onClose();
            }}
            disabled={additions.length === 0}
            className="h-11 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground disabled:opacity-40"
          >
            Add {additions.length}
          </button>
        </>
      }
    >
      <label htmlFor="automation-contact-search" className="sr-only">
        Search contacts
      </label>
      <input
        id="automation-contact-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or email"
        autoComplete="off"
        className="h-11 w-full rounded-xl border bg-muted px-3 text-base outline-none placeholder:text-muted-foreground focus:border-primary/60"
      />

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={selectAllShown}
          className="h-11 flex-1 rounded-xl border bg-muted px-3 text-sm font-semibold"
        >
          Select all shown
        </button>
        <button
          type="button"
          onClick={() => setPicked(new Set())}
          className="h-11 flex-1 rounded-xl border bg-muted px-3 text-sm font-semibold"
        >
          Clear
        </button>
      </div>

      <ul className="mt-2 max-h-[45vh] overflow-y-auto rounded-xl bg-muted">
        {shown.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">No contacts match.</li>
        ) : (
          shown.map((contact) => {
            const email = contact.email.trim().toLowerCase();
            return (
              <li key={email} className="border-b border-foreground/10 last:border-b-0">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={picked.has(email)}
                    onChange={() => toggle(email)}
                    className="h-5 w-5 shrink-0"
                  />
                  <span className="min-w-0">
                    {contact.name && (
                      <span className="block truncate text-[15px] font-semibold text-foreground">
                        {contact.name}
                      </span>
                    )}
                    <span className="block truncate text-sm text-muted-foreground">
                      {contact.email}
                    </span>
                  </span>
                </label>
              </li>
            );
          })
        )}
      </ul>
    </AutomationDialog>
  );
}

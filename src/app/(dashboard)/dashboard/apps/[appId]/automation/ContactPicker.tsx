"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  contactPickerEmptyMessage,
  filterContacts,
  type AutomationContact,
  type AutomationRecipient,
  type SchedulingCustomer,
} from "@/lib/automation/ui";

type Source = "customers" | "contacts";

const BUTTON_CLASS = "h-11 px-4 sm:h-9";

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

/** The people one source offers, already on the reminder or not; names are optional on Gmail contacts. */
function PeopleList({
  people,
  total,
  picked,
  onToggle,
}: {
  people: AutomationContact[];
  total: number;
  picked: Set<string>;
  onToggle: (email: string) => void;
}) {
  if (people.length === 0) {
    return (
      <p className="rounded-lg border px-3 py-4 text-sm text-muted-foreground">
        {contactPickerEmptyMessage(total, 0)}
      </p>
    );
  }

  return (
    <ul className="max-h-[40vh] divide-y overflow-y-auto rounded-lg border">
      {people.map((person, index) => {
        const key = emailKey(person.email);
        // Two customers can share one inbox (a couple, a household): the ticks follow the address, but each row
        // still needs its own React key.
        return (
          <li key={`${key}:${index}`}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                checked={picked.has(key)}
                onChange={() => onToggle(key)}
                className="h-5 w-5 shrink-0"
              />
              <span className="min-w-0">
                {person.name && (
                  <span className="block truncate text-sm font-semibold">{person.name}</span>
                )}
                <span className="block truncate text-sm text-muted-foreground">
                  {person.email}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The Choose people window: the app's Scheduling customers and, when Google allowed it, the owner's Gmail
 * contacts. People already on the message start ticked; Add N adds only the newly ticked ones.
 */
export function ContactPicker({
  customers,
  contacts,
  contactsLoading,
  contactsError,
  canUseGmailContacts,
  chosen,
  onAdd,
  onClose,
}: {
  customers: SchedulingCustomer[];
  contacts: AutomationContact[] | null;
  contactsLoading: boolean;
  contactsError: string | null;
  canUseGmailContacts: boolean;
  chosen: AutomationRecipient[];
  onAdd: (additions: AutomationRecipient[]) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Source>("customers");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(chosen.map((recipient) => emailKey(recipient.email)))
  );

  const customerPeople = useMemo(
    () => customers.map((customer) => ({ name: customer.name, email: customer.email })),
    [customers]
  );
  const gmailPeople = useMemo(() => contacts ?? [], [contacts]);

  const activePeople = tab === "contacts" ? gmailPeople : customerPeople;
  const shown = useMemo(
    () => filterContacts(activePeople, query),
    [activePeople, query]
  );

  const chosenEmails = useMemo(
    () => new Set(chosen.map((recipient) => emailKey(recipient.email))),
    [chosen]
  );

  // One address from either source: the first row for it wins, as the server does.
  const allPeople = useMemo(() => {
    const seen = new Set<string>();
    const people: AutomationContact[] = [];
    for (const person of [...customerPeople, ...gmailPeople]) {
      const key = emailKey(person.email);
      if (seen.has(key)) continue;
      seen.add(key);
      people.push(person);
    }
    return people;
  }, [customerPeople, gmailPeople]);

  const additions = allPeople.filter((person) => {
    const key = emailKey(person.email);
    return picked.has(key) && !chosenEmails.has(key);
  });

  function toggle(email: string) {
    const key = emailKey(email);
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
      for (const person of shown) next.add(emailKey(person.email));
      return next;
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose people</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as Source)}>
          <TabsList className="w-full">
            <TabsTrigger value="customers" className="flex-1">
              My customers
            </TabsTrigger>
            {canUseGmailContacts && (
              <TabsTrigger value="contacts" className="flex-1">
                Gmail contacts
              </TabsTrigger>
            )}
          </TabsList>

          <label htmlFor="automation-contact-search" className="sr-only">
            Search people
          </label>
          <input
            id="automation-contact-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            autoComplete="off"
            className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 px-3"
              onClick={selectAllShown}
            >
              Select all shown
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 px-3"
              onClick={() => setPicked(new Set())}
            >
              Clear
            </Button>
          </div>

          <TabsContent value="customers">
            <PeopleList
              people={shown}
              total={customerPeople.length}
              picked={picked}
              onToggle={toggle}
            />
          </TabsContent>

          {canUseGmailContacts && (
            <TabsContent value="contacts">
              {contactsLoading ? (
                <div
                  className="flex items-center justify-center gap-2 rounded-lg border px-3 py-6 text-sm text-muted-foreground"
                  role="status"
                >
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading contacts…
                </div>
              ) : contactsError ? (
                <p role="alert" className="rounded-lg border px-3 py-4 text-sm text-red-600">
                  {contactsError}
                </p>
              ) : (
                <PeopleList
                  people={shown}
                  total={gmailPeople.length}
                  picked={picked}
                  onToggle={toggle}
                />
              )}
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className={BUTTON_CLASS}
            onClick={onClose}
          >
            Done
          </Button>
          <Button
            type="button"
            className={BUTTON_CLASS}
            disabled={additions.length === 0}
            onClick={() => {
              onAdd(additions);
              onClose();
            }}
          >
            Add {additions.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

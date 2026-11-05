"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/types/database";

type CustomerRow = Database["public"]["Tables"]["schedule_customers"]["Row"];

interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  entry_notes: string;
  notes: string;
}

const EMPTY_FORM: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  entry_notes: "",
  notes: "",
};

function sortByName(customers: CustomerRow[]): CustomerRow[] {
  return [...customers].sort((a, b) => a.name.localeCompare(b.name));
}

export function CustomersManager({
  appId,
  initialCustomers,
}: {
  appId: string;
  initialCustomers: CustomerRow[];
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CustomerRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function setField<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(customer: CustomerRow) {
    setEditing(customer);
    setForm({
      name: customer.name,
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      entry_notes: customer.entry_notes ?? "",
      notes: customer.notes ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Enter a name.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        editing
          ? `/api/apps/${appId}/schedule/customers/${editing.id}`
          : `/api/apps/${appId}/schedule/customers`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const body = (await res.json().catch(() => null)) as
        | { customer?: CustomerRow; error?: string }
        | null;

      if (!res.ok || !body?.customer) {
        setError(body?.error ?? "Could not save this customer. Try again.");
        return;
      }

      const saved = body.customer;
      setCustomers((prev) =>
        sortByName(editing ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved])
      );
      setFormOpen(false);
      toast.success(editing ? "Customer saved" : "Customer added");
    } catch {
      setError("Could not save this customer. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;

    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/schedule/customers/${deleting.id}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setDeleteError(body?.error ?? "Could not delete this customer. Try again.");
        return;
      }

      setCustomers((prev) => prev.filter((c) => c.id !== deleting.id));
      setDeleting(null);
      toast.success("Customer deleted");
    } catch {
      setDeleteError("Could not delete this customer. Check your connection and try again.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {customers.length === 1 ? "1 customer" : `${customers.length} customers`}
        </p>
        <Button type="button" className="min-h-11 sm:min-h-0 px-4" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add customer
        </Button>
      </div>

      {customers.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-muted-foreground ring-1 ring-black/5">
          No customers yet. Add your first one.
        </p>
      ) : (
        <ul className="space-y-3">
          {customers.map((customer) => (
            <li key={customer.id} className="rounded-xl bg-white p-4 ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold break-words">{customer.name}</p>
                  {customer.email && (
                    <p className="text-sm break-words text-muted-foreground">{customer.email}</p>
                  )}
                  {customer.phone && (
                    <p className="text-sm break-words text-muted-foreground">{customer.phone}</p>
                  )}
                  {customer.address && (
                    <p className="text-sm break-words text-muted-foreground">{customer.address}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 sm:size-8"
                    aria-label={`Edit ${customer.name}`}
                    onClick={() => openEdit(customer)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 sm:size-8"
                    aria-label={`Delete ${customer.name}`}
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting(customer);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={formOpen} onOpenChange={(next) => !saving && setFormOpen(next)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit customer" : "Add customer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="customer-name">Name</Label>
              <Input
                id="customer-name"
                required
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className="h-11 sm:h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="h-11 sm:h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className="h-11 sm:h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="customer-address">Address</Label>
              <Input
                id="customer-address"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
                className="h-11 sm:h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="customer-entry-notes">Entry notes</Label>
              <Input
                id="customer-entry-notes"
                value={form.entry_notes}
                onChange={(e) => setField("entry_notes", e.target.value)}
                className="h-11 sm:h-8"
              />
              <p className="text-xs text-muted-foreground">Gate code, pets, where the key is</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="customer-notes">Notes</Label>
              <Textarea
                id="customer-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                disabled={saving}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-11 sm:h-9" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save" : "Add customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next && !deleteBusy) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name ?? "customer"}?</DialogTitle>
            <DialogDescription>Their visits are removed too.</DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p role="alert" className="text-sm text-red-600">
              {deleteError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-9"
              disabled={deleteBusy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 sm:h-9"
              disabled={deleteBusy}
              onClick={handleDelete}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Miroir des tables Supabase (supabase/migrations/0001_init.sql).

export type DocumentStatus = "draft" | "sent" | "signed" | "paid" | "canceled";

export type Client = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
};

export type Invoice = {
  id: string;
  status: DocumentStatus;
  quote_number: string;
  invoice_number: string | null;
  total_cents: number;
  sent_at: string | null;
  signed_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  reminders_sent: number;
  client: Pick<Client, "name" | "phone">;
};

/** Statut affiché : "En retard" est dérivé de due_at, pas stocké. */
export type DisplayStatus = "draft" | "sent" | "signed" | "late" | "paid";

export function displayStatus(inv: Invoice, now = new Date()): DisplayStatus {
  if (inv.status === "paid") return "paid";
  if (inv.status === "signed" && inv.due_at && new Date(inv.due_at) < now) return "late";
  if (inv.status === "signed") return "signed";
  if (inv.status === "sent") return "sent";
  return "draft";
}

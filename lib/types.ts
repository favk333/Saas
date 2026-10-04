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

export type LineItem = {
  position: number;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
};

export type InvoiceDetail = Invoice & {
  user_id: string;
  site_address: string | null;
  tax_bps: number;
  subtotal_cents: number;
  tax_cents: number;
  sign_token: string;
  stripe_payment_link_url: string | null;
  line_items: LineItem[];
};

export const INVOICE_DETAIL_SELECT =
  "id, user_id, status, quote_number, invoice_number, site_address, tax_bps, subtotal_cents, tax_cents, total_cents, sign_token, stripe_payment_link_url, sent_at, signed_at, due_at, paid_at, reminders_sent, client:clients(name, phone), line_items(position, description, quantity, unit_price_cents, total_cents)";

import type { Invoice } from "./types";

// Données de démonstration. Remplacé par une requête Supabase à l'étape suivante :
//   supabase.from("invoices").select("*, client:clients(name, phone)").neq("status", "canceled")

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const invoices: Invoice[] = [
  { id: "1", status: "signed", quote_number: "D-2026-0042", invoice_number: "F-2026-0031", total_cents: 184_000, sent_at: ago(12), signed_at: ago(11), due_at: ago(4), paid_at: null, reminders_sent: 2, client: { name: "Mme Lefèvre", phone: "+33611223344" } },
  { id: "2", status: "signed", quote_number: "D-2026-0045", invoice_number: "F-2026-0033", total_cents: 62_350, sent_at: ago(3), signed_at: ago(2), due_at: ago(-5), paid_at: null, reminders_sent: 0, client: { name: "SCI Les Tilleuls", phone: "+33622334455" } },
  { id: "3", status: "sent", quote_number: "D-2026-0047", invoice_number: null, total_cents: 345_900, sent_at: ago(1), signed_at: null, due_at: null, paid_at: null, reminders_sent: 0, client: { name: "M. Garnier", phone: "+33633445566" } },
  { id: "4", status: "paid", quote_number: "D-2026-0040", invoice_number: "F-2026-0029", total_cents: 98_000, sent_at: ago(9), signed_at: ago(9), due_at: ago(2), paid_at: ago(6), reminders_sent: 0, client: { name: "M. Rousseau", phone: "+33644556677" } },
  { id: "5", status: "paid", quote_number: "D-2026-0038", invoice_number: "F-2026-0027", total_cents: 215_500, sent_at: ago(20), signed_at: ago(19), due_at: ago(12), paid_at: ago(15), reminders_sent: 1, client: { name: "Boulangerie Petit", phone: "+33655667788" } },
];

export async function getDashboard() {
  return {
    companyName: "Dupont Électricité",
    pending: invoices.filter((i) => i.status === "sent" || i.status === "signed"),
    paid: invoices.filter((i) => i.status === "paid"),
  };
}

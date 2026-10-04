import { createAdminClient } from "./supabase/admin";
import { createClient, getUser, getUserId } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";
import { INVOICE_DETAIL_SELECT, type Invoice, type InvoiceDetail } from "./types";

const PENDING = new Set(["draft", "sent", "signed"]);

export async function getDashboard() {
  if (!isSupabaseConfigured) return demoDashboard();

  const supabase = await createClient();
  const [{ data: profile }, { data, error }] = await Promise.all([
    supabase.from("profiles").select("company_name, stripe_charges_enabled").maybeSingle(),
    supabase
      .from("invoices")
      .select("id, status, quote_number, invoice_number, total_cents, sent_at, signed_at, due_at, paid_at, reminders_sent, client:clients(name, phone)")
      .neq("status", "canceled")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (error) throw error;

  const invoices = (data ?? []) as unknown as Invoice[];
  return {
    companyName: (profile?.company_name as string | undefined) ?? "",
    paymentsEnabled: Boolean(profile?.stripe_charges_enabled),
    pending: invoices.filter((i) => PENDING.has(i.status)),
    paid: invoices.filter((i) => i.status === "paid"),
  };
}

export async function getDefaultTaxBps() {
  if (!isSupabaseConfigured) return 2000;
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return 2000;
  const { data } = await supabase.from("profiles").select("default_tax_bps").eq("id", userId).maybeSingle();
  return data?.default_tax_bps ?? 2000;
}

function sortLines(inv: InvoiceDetail) {
  inv.line_items.sort((a, b) => a.position - b.position);
  return inv;
}

/** Devis/facture de l'artisan connecté (RLS). */
export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  if (!isSupabaseConfigured) return demoDetail((i) => i.id === id);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select(INVOICE_DETAIL_SELECT).eq("id", id).maybeSingle();
  return data ? sortLines(data as unknown as InvoiceDetail) : null;
}

/** Accès public par jeton de signature (service role). */
export async function getInvoiceByToken(token: string) {
  if (!isSupabaseConfigured) {
    const invoice = demoDetail((i) => i.sign_token === token);
    return invoice && { invoice, companyName: "Dupont Électricité" };
  }
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("invoices")
    .select(INVOICE_DETAIL_SELECT)
    .eq("sign_token", token)
    .neq("status", "canceled")
    .maybeSingle();
  if (!data) return null;
  const invoice = sortLines(data as unknown as InvoiceDetail);
  const { data: profile } = await admin.from("profiles").select("company_name").eq("id", invoice.user_id).maybeSingle();
  return { invoice, companyName: profile?.company_name || "" };
}

export type Profile = {
  email: string | null;
  company_name: string;
  phone: string | null;
  siret: string | null;
  address: string | null;
  default_tax_bps: number;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
};

export async function getProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured) {
    return {
      email: "contact@dupont-elec.fr", company_name: "Dupont Électricité", phone: "+33611223344",
      siret: "12345678900012", address: "4 rue du Port, 69002 Lyon", default_tax_bps: 2000,
      stripe_account_id: null, stripe_charges_enabled: false,
    };
  }
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("company_name, phone, siret, address, default_tax_bps, stripe_account_id, stripe_charges_enabled")
    .eq("id", user.id)
    .maybeSingle();
  return data ? { email: user.email, ...data } : null;
}

// ---- Mode démo (pas de .env.local) ----

function demoDetail(match: (i: InvoiceDetail) => boolean): InvoiceDetail | null {
  const base = demoDashboard();
  const all = [...base.pending, ...base.paid].map((inv, n): InvoiceDetail => {
    const lines = [
      { position: 0, description: "Remplacement tableau électrique", quantity: 1, unit_price_cents: Math.round((inv.total_cents / 1.1) * 0.7), total_cents: 0 },
      { position: 1, description: "Main d'œuvre", quantity: 1, unit_price_cents: 0, total_cents: 0 },
    ];
    const subtotal = Math.round(inv.total_cents / 1.1);
    lines[0].total_cents = lines[0].unit_price_cents;
    lines[1].unit_price_cents = lines[1].total_cents = subtotal - lines[0].total_cents;
    return {
      ...inv,
      user_id: "demo",
      site_address: "12 rue des Lilas, 69003 Lyon",
      tax_bps: 1000,
      subtotal_cents: subtotal,
      tax_cents: inv.total_cents - subtotal,
      sign_token: `demo${n}`,
      stripe_payment_link_url: inv.status === "signed" && inv.id === "1" ? "https://buy.stripe.com/test_demo" : null,
      line_items: lines,
    };
  });
  return all.find(match) ?? null;
}

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function demoDashboard() {
  const invoices: Invoice[] = [
    { id: "1", status: "signed", quote_number: "D-2026-0042", invoice_number: "F-2026-0031", total_cents: 184_000, sent_at: ago(12), signed_at: ago(11), due_at: ago(4), paid_at: null, reminders_sent: 2, client: { name: "Mme Lefèvre", phone: "+33611223344" } },
    { id: "2", status: "signed", quote_number: "D-2026-0045", invoice_number: "F-2026-0033", total_cents: 62_350, sent_at: ago(3), signed_at: ago(2), due_at: ago(-5), paid_at: null, reminders_sent: 0, client: { name: "SCI Les Tilleuls", phone: "+33622334455" } },
    { id: "3", status: "sent", quote_number: "D-2026-0047", invoice_number: null, total_cents: 345_900, sent_at: ago(1), signed_at: null, due_at: null, paid_at: null, reminders_sent: 0, client: { name: "M. Garnier", phone: "+33633445566" } },
    { id: "4", status: "paid", quote_number: "D-2026-0040", invoice_number: "F-2026-0029", total_cents: 98_000, sent_at: ago(9), signed_at: ago(9), due_at: ago(2), paid_at: ago(6), reminders_sent: 0, client: { name: "M. Rousseau", phone: "+33644556677" } },
    { id: "5", status: "paid", quote_number: "D-2026-0038", invoice_number: "F-2026-0027", total_cents: 215_500, sent_at: ago(20), signed_at: ago(19), due_at: ago(12), paid_at: ago(15), reminders_sent: 1, client: { name: "Boulangerie Petit", phone: "+33655667788" } },
  ];
  return {
    companyName: "Dupont Électricité",
    paymentsEnabled: true,
    pending: invoices.filter((i) => PENDING.has(i.status)),
    paid: invoices.filter((i) => i.status === "paid"),
  };
}

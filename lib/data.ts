import { createAdminClient } from "./supabase/admin";
import { createClient, getUser, getUserId } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";
import { platformFee } from "./fees";
import { computeTotals, type TaxRegime } from "./quote";
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

export async function getDefaultTaxRegime(): Promise<TaxRegime> {
  if (!isSupabaseConfigured) return "qc";
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return "qc";
  const { data } = await supabase.from("profiles").select("default_tax_regime").eq("id", userId).maybeSingle();
  return data?.default_tax_regime ?? "qc";
}

function sortLines(inv: InvoiceDetail) {
  inv.line_items.sort((a, b) => a.position - b.position);
  return inv;
}

/** Soumission ou facture de l'artisan connecté (RLS). */
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
  neq: string | null;
  rbq_licence: string | null;
  address: string | null;
  tps_number: string | null;
  tvq_number: string | null;
  insurance: string | null;
  default_tax_regime: TaxRegime;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
};

export async function getProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured) {
    return {
      email: "info@tremblay-electrique.ca", company_name: "Tremblay Électrique", phone: "+15145551234",
      neq: "1171234567", rbq_licence: "5678123401", address: "1200 rue Sainte-Catherine O., Montréal (Québec) H3B 1K9", default_tax_regime: "qc",
      tps_number: "123456789RT0001", tvq_number: "1234567890TQ0001", insurance: "Responsabilité civile Intact, police n° 123456",
      stripe_account_id: null, stripe_charges_enabled: false,
    };
  }
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("company_name, phone, neq, rbq_licence, address, tps_number, tvq_number, insurance, default_tax_regime, stripe_account_id, stripe_charges_enabled")
    .eq("id", user.id)
    .maybeSingle();
  return data ? { email: user.email, ...data } : null;
}

// ---- Mode démo (pas de .env.local) ----

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

// Montants définis hors taxes ; TPS / TVQ / total calculés comme en base.
const DEMO = [
  { id: "1", status: "signed", quote_number: "S-2026-0042", invoice_number: "F-2026-0031", subtotal: 160_000, sent_at: ago(12), signed_at: ago(11), due_at: ago(4), paid_at: null, reminders_sent: 2, client: { name: "Mme Lefebvre", phone: "+15145551201" } },
  { id: "2", status: "signed", quote_number: "S-2026-0045", invoice_number: "F-2026-0033", subtotal: 54_250, sent_at: ago(3), signed_at: ago(2), due_at: ago(-5), paid_at: null, reminders_sent: 0, client: { name: "Syndicat Les Érables", phone: "+14385551202" } },
  { id: "3", status: "sent", quote_number: "S-2026-0047", invoice_number: null, subtotal: 300_800, sent_at: ago(1), signed_at: null, due_at: null, paid_at: null, reminders_sent: 0, client: { name: "M. Gagnon", phone: "+14505551203" } },
  { id: "4", status: "paid", quote_number: "S-2026-0040", invoice_number: "F-2026-0029", subtotal: 85_200, sent_at: ago(9), signed_at: ago(9), due_at: ago(2), paid_at: ago(6), reminders_sent: 0, client: { name: "M. Roy", phone: "+15145551204" } },
  { id: "5", status: "paid", quote_number: "S-2026-0038", invoice_number: "F-2026-0027", subtotal: 187_400, sent_at: ago(20), signed_at: ago(19), due_at: ago(12), paid_at: ago(15), reminders_sent: 1, client: { name: "Boulangerie Côté", phone: "+18195551205" } },
] as const;

function demoDetails(): InvoiceDetail[] {
  return DEMO.map(({ subtotal, ...inv }, n) => {
    const t = computeTotals([subtotal], "qc");
    const material = Math.round(subtotal * 0.7);
    return {
      ...inv,
      client: { ...inv.client },
      user_id: "demo",
      site_address: "4520 rue Saint-Denis, Montréal (Québec) H2J 2L3",
      tax_regime: "qc",
      subtotal_cents: subtotal,
      tps_cents: t.tps,
      tvq_cents: t.tvq,
      tax_cents: t.tax,
      total_cents: t.total,
      sign_token: `demo${n}`,
      stripe_payment_link_url: inv.id === "1" ? "https://buy.stripe.com/test_demo" : null,
      ...(inv.id === "1"
        ? (() => {
            const fee = platformFee(t.total, { bps: 100, fixedCents: 30, taxNumbers: { tps: "987654321RT0001", tvq: "9876543210TQ0001" } });
            return { platform_fee_cents: fee.base, platform_fee_tps_cents: fee.tps, platform_fee_tvq_cents: fee.tvq };
          })()
        : { platform_fee_cents: null, platform_fee_tps_cents: null, platform_fee_tvq_cents: null }),
      signature_path: null,
      signed_via: inv.signed_at ? "on_site" : null,
      signed_offline: false,
      created_at: inv.sent_at,
      line_items: [
        { position: 0, description: "Remplacement panneau électrique 200 A", quantity: 1, unit_price_cents: material, total_cents: material },
        { position: 1, description: "Main-d'œuvre", quantity: 1, unit_price_cents: subtotal - material, total_cents: subtotal - material },
      ],
    };
  });
}

function demoDetail(match: (i: InvoiceDetail) => boolean): InvoiceDetail | null {
  return demoDetails().find(match) ?? null;
}

function demoDashboard() {
  const invoices: Invoice[] = demoDetails();
  return {
    companyName: "Tremblay Électrique",
    paymentsEnabled: true,
    pending: invoices.filter((i) => PENDING.has(i.status)),
    paid: invoices.filter((i) => i.status === "paid"),
  };
}

/** Identifiant de l'artisan connecté ("demo" en mode démo). Sert à rattacher la file hors ligne au bon compte. */
export async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return "demo";
  return getUserId(await createClient());
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPaymentLink } from "./stripe";

/**
 * Crée le lien de paiement d'une facture signée s'il n'existe pas encore.
 * `supabase` : client artisan (RLS) ou admin (signature à distance).
 */
export async function ensurePaymentLink(supabase: SupabaseClient, invoiceId: string): Promise<string> {
  const { data: inv, error } = await supabase
    .from("invoices")
    .select("id, user_id, status, invoice_number, total_cents, currency, stripe_payment_link_url")
    .eq("id", invoiceId)
    .single();
  if (error || !inv) throw new Error("Facture introuvable");
  if (inv.stripe_payment_link_url) return inv.stripe_payment_link_url;
  if (inv.status !== "signed" || !inv.invoice_number) throw new Error("Facture non signée");

  const { data: profile } = await supabase.from("profiles").select("stripe_account_id").eq("id", inv.user_id).single();

  const link = await createPaymentLink({
    invoiceId: inv.id,
    invoiceNumber: inv.invoice_number,
    totalCents: inv.total_cents,
    currency: inv.currency,
    stripeAccountId: profile?.stripe_account_id ?? null,
  });

  await supabase
    .from("invoices")
    .update({ stripe_payment_link_id: link.id, stripe_payment_link_url: link.url })
    .eq("id", inv.id);
  return link.url;
}

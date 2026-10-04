import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { feeConfig, platformFee } from "./fees";
import { createPaymentLink } from "./stripe";

export class PaymentsNotEnabledError extends Error {
  constructor() {
    super("Paiements en ligne non activés (Réglages)");
  }
}

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_account_id, stripe_charges_enabled")
    .eq("id", inv.user_id)
    .single();
  // L'argent doit arriver sur le compte de l'artisan, jamais sur celui de la plateforme.
  if (!profile?.stripe_account_id || !profile.stripe_charges_enabled) throw new PaymentsNotEnabledError();

  const fee = platformFee(inv.total_cents, feeConfig()); // commission + TPS / TVQ si la plateforme est inscrite
  const link = await createPaymentLink({
    invoiceId: inv.id,
    invoiceNumber: inv.invoice_number,
    totalCents: inv.total_cents,
    currency: inv.currency,
    stripeAccountId: profile.stripe_account_id,
    applicationFeeCents: fee.total,
  });

  await supabase
    .from("invoices")
    .update({
      stripe_payment_link_id: link.id,
      stripe_payment_link_url: link.url,
      platform_fee_cents: fee.base,
      platform_fee_tps_cents: fee.tps,
      platform_fee_tvq_cents: fee.tvq,
    })
    .eq("id", inv.id);
  return link.url;
}

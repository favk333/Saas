"use server";

import { redirect } from "next/navigation";
import type { SignatureState } from "@/components/signature/signature-form";
import { getInvoiceByToken } from "@/lib/data";
import { ensurePaymentLink } from "@/lib/payments";
import { decodeSignature, recordSignature } from "@/lib/signature";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function signRemote(_prev: SignatureState, formData: FormData): Promise<SignatureState> {
  const token = String(formData.get("token"));
  const png = decodeSignature(formData.get("signature"));
  if (!png) return { error: "Signature illisible. Recommencez." };
  if (!isSupabaseConfigured) return { error: "Démonstration : signature non enregistrée." };

  const found = await getInvoiceByToken(token);
  if (!found || found.invoice.status !== "sent") return { error: "Ce devis n'est plus signable." };

  const admin = createAdminClient();
  try {
    const ok = await recordSignature(admin, found.invoice, png, "remote", ["sent"]);
    if (!ok) return { error: "Ce devis n'est plus signable." };
  } catch {
    return { error: "Enregistrement impossible. Réessayez." };
  }

  // Le client signe à distance : on lui propose de payer tout de suite.
  // Si Stripe échoue, l'artisan pourra générer le lien depuis l'app.
  await ensurePaymentLink(admin, found.invoice.id).catch(() => null);

  redirect(`/s/${token}`);
}

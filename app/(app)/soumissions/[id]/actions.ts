"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SignatureState } from "@/components/signature/signature-form";
import { getInvoice } from "@/lib/data";
import { formatCents } from "@/lib/format";
import { ensurePaymentLink, PaymentsNotEnabledError } from "@/lib/payments";
import { decodeSignature, recordSignature } from "@/lib/signature";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient, getUserId } from "@/lib/supabase/server";
import { sendSms } from "@/lib/twilio";

const DEMO = "Mode démo : configurez Supabase (.env.local).";

export type ActionState = { error: string | null; done?: boolean };

export async function signOnSite(_prev: SignatureState, formData: FormData): Promise<SignatureState> {
  const id = String(formData.get("id"));
  const png = decodeSignature(formData.get("signature"));
  if (!png) return { error: "Signature illisible. Recommencez." };
  if (!isSupabaseConfigured) return { error: DEMO };

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");

  try {
    const ok = await recordSignature(supabase, { id, user_id: userId }, png, "on_site", ["draft", "sent"]);
    if (!ok) return { error: "Cette soumission n'est plus signable." };
  } catch {
    return { error: "Enregistrement de la signature impossible. Réessayez." };
  }
  redirect(`/soumissions/${id}`);
}

export async function generatePaymentLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  if (!isSupabaseConfigured) return { error: DEMO };
  try {
    await ensurePaymentLink(await createClient(), id);
  } catch (e) {
    if (e instanceof PaymentsNotEnabledError) return { error: "Activez d'abord les paiements dans Réglages." };
    console.error("Création du lien de paiement impossible", e); // Stripe indisponible, commission mal configurée…
    return { error: "Création du lien impossible. Réessayez." };
  }
  revalidatePath(`/soumissions/${id}`);
  return { error: null };
}

export async function sendPaymentLinkSms(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured) return { error: DEMO };
  const inv = await getInvoice(String(formData.get("id")));
  if (!inv?.stripe_payment_link_url || inv.status !== "signed") return { error: "Aucun lien de paiement." };
  try {
    await sendSms(
      inv.client.phone,
      `Merci pour votre signature. Facture ${inv.invoice_number} : ${formatCents(inv.total_cents)}. Paiement sécurisé : ${inv.stripe_payment_link_url}`,
    );
  } catch {
    return { error: "SMS non envoyé. Réessayez." };
  }
  return { error: null, done: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { getInvoice } from "@/lib/data";
import { ensurePaymentLink } from "@/lib/payments";
import { reminderSms, signatureReminderSms } from "@/lib/reminders";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/twilio";

export type RemindState = { error: string | null; done?: boolean };

const HOUR = 3_600_000;

/**
 * Relance manuelle depuis l'accueil :
 * devis envoyé → lien de signature ; facture signée → lien de paiement.
 * Ne touche pas au compteur des relances automatiques (J+3 / J+7).
 */
export async function remindBySms(_prev: RemindState, formData: FormData): Promise<RemindState> {
  if (!isSupabaseConfigured) return { error: "Mode démo : SMS non envoyé." };

  const id = String(formData.get("invoiceId"));
  const supabase = await createClient();
  const inv = await getInvoice(id);
  if (!inv || (inv.status !== "sent" && inv.status !== "signed")) return { error: "Relance impossible." };

  const { data: meta } = await supabase.from("invoices").select("last_reminder_at").eq("id", id).single();
  if (meta?.last_reminder_at && Date.now() - new Date(meta.last_reminder_at).getTime() < HOUR) {
    return { error: "Déjà relancé il y a moins d'une heure." };
  }

  const { data: profile } = await supabase.from("profiles").select("company_name").eq("id", inv.user_id).single();
  const company = profile?.company_name ?? "";

  try {
    const body =
      inv.status === "sent"
        ? signatureReminderSms({
            company,
            number: inv.quote_number,
            totalCents: inv.total_cents,
            url: `${process.env.NEXT_PUBLIC_APP_URL}/s/${inv.sign_token}`,
          })
        : reminderSms(0, {
            company,
            number: inv.invoice_number!,
            totalCents: inv.total_cents,
            url: await ensurePaymentLink(supabase, id),
          });
    await sendSms(inv.client.phone, body);
  } catch {
    return { error: "SMS non envoyé. Réessayez." };
  }

  await supabase.from("invoices").update({ last_reminder_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/");
  return { error: null, done: true };
}

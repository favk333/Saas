"use server";

import { redirect } from "next/navigation";
import { computeTotals, isTaxRegime, normalizePhone, parseAmount } from "@/lib/quote";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient, getUserId } from "@/lib/supabase/server";
import { sendSms } from "@/lib/twilio";
import { formatCents } from "@/lib/format";

export type QuoteFormState = { error: string | null };

export async function createQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const intent = formData.get("intent") === "sms" ? "sms" : "sign";
  const name = String(formData.get("clientName") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const siteAddress = String(formData.get("siteAddress") ?? "").trim() || null;
  const taxRegime = formData.get("taxRegime");

  const descriptions = formData.getAll("description").map((v) => String(v).trim());
  const prices = formData.getAll("price").map((v) => String(v));
  // Les lignes entièrement vides sont ignorées.
  const items = descriptions
    .map((description, i) => ({ description, price: (prices[i] ?? "").trim() }))
    .filter((it) => it.description || it.price)
    .map((it) => ({ description: it.description, cents: parseAmount(it.price) }));

  if (!name) return { error: "Nom du client manquant." };
  if (!phone) return { error: "Numéro de téléphone invalide." };
  if (!isTaxRegime(taxRegime)) return { error: "Régime de taxes invalide." };
  if (items.length === 0) return { error: "Ajoutez au moins une ligne." };
  if (items.some((it) => !it.description)) return { error: "Une ligne n'a pas de description." };
  if (items.some((it) => it.cents === null)) return { error: "Un prix est invalide." };

  if (!isSupabaseConfigured) return { error: "Mode démo : configurez Supabase (.env.local) pour enregistrer." };

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .upsert({ user_id: userId, name, phone, address: siteAddress }, { onConflict: "user_id,phone" })
    .select("id")
    .single();
  if (clientError) return { error: "Enregistrement du client impossible." };

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({ user_id: userId, client_id: client.id, site_address: siteAddress, tax_regime: taxRegime })
    .select("id, sign_token, quote_number")
    .single();
  if (invoiceError) return { error: "Enregistrement du devis impossible." };

  const { error: itemsError } = await supabase.from("line_items").insert(
    items.map((it, position) => ({
      invoice_id: invoice.id,
      user_id: userId,
      position,
      description: it.description,
      unit_price_cents: it.cents!,
    })),
  );
  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { error: "Enregistrement des lignes impossible." };
  }

  if (intent === "sms") {
    const { total } = computeTotals(items.map((it) => it.cents!), taxRegime);
    const link = `${process.env.NEXT_PUBLIC_APP_URL}/s/${invoice.sign_token}`;
    try {
      await sendSms(phone, `Bonjour, voici votre devis ${invoice.quote_number} (${formatCents(total)}). Consultez-le et signez ici : ${link}`);
    } catch {
      // Rien n'est conservé : un nouvel essai ne crée pas de doublon.
      await supabase.from("invoices").delete().eq("id", invoice.id);
      return { error: "SMS non envoyé. Vérifiez le numéro et réessayez." };
    }
    await supabase.from("invoices").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", invoice.id);
    redirect("/");
  }

  redirect(`/devis/${invoice.id}/signer`);
}

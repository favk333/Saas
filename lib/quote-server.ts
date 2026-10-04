import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCents } from "./format";
import { computeTotals, type QuoteInput } from "./quote";
import { sendSms } from "./twilio";

export type QuoteRecord = { id: string; status: string; sign_token: string; quote_number: string };

/**
 * Crée client + soumission + lignes.
 * `id` (facultatif) vient du téléphone pour les soumissions faites hors ligne :
 * si elle existe déjà (renvoi après une coupure), on la renvoie telle quelle.
 */
export async function createQuoteRecord(
  supabase: SupabaseClient,
  userId: string,
  input: QuoteInput,
  id?: string,
): Promise<{ quote: QuoteRecord; created: boolean } | { error: string }> {
  const existing = async () => {
    if (!id) return null;
    const { data } = await supabase
      .from("invoices")
      .select("id, status, sign_token, quote_number")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    return data as QuoteRecord | null;
  };

  const already = await existing();
  if (already) return { quote: already, created: false };

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .upsert({ user_id: userId, name: input.clientName, phone: input.phone, address: input.siteAddress }, { onConflict: "user_id,phone" })
    .select("id")
    .single();
  if (clientError) return { error: "Enregistrement du client impossible." };

  const { data: quote, error: quoteError } = await supabase
    .from("invoices")
    .insert({ ...(id ? { id } : {}), user_id: userId, client_id: client.id, site_address: input.siteAddress, tax_regime: input.taxRegime })
    .select("id, status, sign_token, quote_number")
    .single();
  if (quoteError) {
    // Deux envois simultanés du même identifiant : l'autre a gagné.
    const raced = quoteError.code === "23505" ? await existing() : null;
    return raced ? { quote: raced, created: false } : { error: "Enregistrement de la soumission impossible." };
  }

  const { error: itemsError } = await supabase.from("line_items").insert(
    input.items.map((it, position) => ({
      invoice_id: quote.id,
      user_id: userId,
      position,
      description: it.description,
      unit_price_cents: it.cents,
    })),
  );
  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", quote.id);
    return { error: "Enregistrement des lignes impossible." };
  }

  return { quote: quote as QuoteRecord, created: true };
}

/**
 * Envoie le lien de signature par SMS et passe la soumission en "sent". Lève une erreur si le SMS échoue.
 * La soumission est réservée (draft → sent) avant l'envoi : si plusieurs requêtes arrivent en même temps
 * (renvoi hors ligne), une seule envoie le SMS. En cas d'échec, la réservation est annulée.
 */
export async function sendSignatureRequest(supabase: SupabaseClient, quote: QuoteRecord, input: QuoteInput) {
  const { data: claimed, error } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", quote.id)
    .eq("status", "draft")
    .select("id");
  if (error) throw error;
  if (!claimed?.length) return; // déjà envoyée par une autre requête

  const { total } = computeTotals(input.items.map((it) => it.cents), input.taxRegime);
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/s/${quote.sign_token}`;
  try {
    await sendSms(
      input.phone,
      `Bonjour, voici votre soumission ${quote.quote_number} (${formatCents(total)}). Consultez-la et signez ici : ${link}`,
    );
  } catch (e) {
    await supabase.from("invoices").update({ status: "draft", sent_at: null }).eq("id", quote.id).eq("status", "sent");
    throw e;
  }
}

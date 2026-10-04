"use server";

import { redirect } from "next/navigation";
import { parseQuoteInput } from "@/lib/quote";
import { createQuoteRecord, sendSignatureRequest } from "@/lib/quote-server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient, getUserId } from "@/lib/supabase/server";

export type QuoteFormState = { error: string | null };

export async function createQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const intent = formData.get("intent") === "sms" ? "sms" : "sign";
  const descriptions = formData.getAll("description").map(String);
  const prices = formData.getAll("price").map(String);
  const parsed = parseQuoteInput({
    clientName: String(formData.get("clientName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    siteAddress: String(formData.get("siteAddress") ?? ""),
    taxRegime: formData.get("taxRegime"),
    lines: descriptions.map((description, i) => ({ description, price: prices[i] ?? "" })),
  });
  if ("error" in parsed) return { error: parsed.error };
  const { input } = parsed;

  if (!isSupabaseConfigured) return { error: "Mode démo : configurez Supabase (.env.local) pour enregistrer." };

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");

  const result = await createQuoteRecord(supabase, userId, input);
  if ("error" in result) return { error: result.error };
  const { quote } = result;

  if (intent === "sms") {
    try {
      await sendSignatureRequest(supabase, quote, input);
    } catch {
      // Rien n'est conservé : un nouvel essai ne crée pas de doublon.
      await supabase.from("invoices").delete().eq("id", quote.id);
      return { error: "SMS non envoyé. Vérifiez le numéro et réessayez." };
    }
    redirect("/");
  }

  redirect(`/soumissions/${quote.id}/signer`);
}

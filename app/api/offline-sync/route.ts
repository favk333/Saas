import { NextResponse, type NextRequest } from "next/server";
import { parseQuoteInput, type QuoteFields } from "@/lib/quote";
import { createQuoteRecord, sendSignatureRequest } from "@/lib/quote-server";
import { clampSignedAt, decodeSignature, recordSignature } from "@/lib/signature";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OutboxItem = {
  id: string;
  userId: string;
  intent: "sign" | "sms";
  fields: QuoteFields;
  signature?: string;
  signedAt?: string;
};

// Codes lus par le service worker (public/sw.js) :
//   2xx → envoyé, retiré de la file
//   401, 502, 503 → nouvel essai plus tard
//   409, 422 → échec définitif, affiché à l'artisan
const retry = (status: number, error: string) => NextResponse.json({ error }, { status });
const fail = (status: 409 | 422, error: string) => NextResponse.json({ error }, { status });

/** Envoi différé d'une soumission faite hors ligne (et de sa signature). Rejouable sans doublon. */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return retry(503, "Mode démo : envoi impossible.");

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return retry(401, "Session expirée : reconnectez-vous pour envoyer.");

  let item: OutboxItem;
  try {
    item = await request.json();
  } catch {
    return fail(422, "Données illisibles.");
  }
  if (typeof item?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(item.id)) return fail(422, "Identifiant invalide.");
  if (item.userId !== userId) return fail(409, "Soumission créée avec un autre compte.");
  if (item.intent !== "sign" && item.intent !== "sms") return fail(422, "Action inconnue.");

  const parsed = parseQuoteInput(item.fields ?? ({} as QuoteFields));
  if ("error" in parsed) return fail(422, parsed.error);
  const { input } = parsed;

  const png = item.intent === "sign" ? decodeSignature(item.signature ?? null) : null;
  if (item.intent === "sign" && !png) return fail(422, "Signature illisible.");

  const result = await createQuoteRecord(supabase, userId, input, item.id);
  if ("error" in result) return retry(502, result.error);
  const { quote } = result;

  if (item.intent === "sign" && (quote.status === "draft" || quote.status === "sent")) {
    try {
      await recordSignature(supabase, { id: quote.id, user_id: userId }, png!, "on_site", ["draft", "sent"], {
        signedAt: clampSignedAt(item.signedAt),
      });
    } catch {
      return retry(502, "Enregistrement de la signature impossible.");
    }
  }

  if (item.intent === "sms" && quote.status === "draft") {
    try {
      await sendSignatureRequest(supabase, quote, input);
    } catch {
      // La soumission reste en brouillon : le prochain essai renverra le SMS.
      return retry(502, "SMS non envoyé.");
    }
  }

  return NextResponse.json({ status: "synced", quoteId: quote.id, quoteNumber: quote.quote_number });
}

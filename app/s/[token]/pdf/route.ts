import { getInvoiceByToken } from "@/lib/data";
import { invoicePdfResponse } from "@/lib/invoice-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

// PDF pour le client (lien reçu par SMS). Les brouillons ne sont jamais exposés.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await getInvoiceByToken(token);
  if (!found || found.invoice.status === "draft") return new Response("Introuvable", { status: 404 });
  return invoicePdfResponse(found.invoice, isSupabaseConfigured ? createAdminClient() : null);
}

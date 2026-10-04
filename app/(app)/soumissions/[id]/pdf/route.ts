import { getInvoice } from "@/lib/data";
import { invoicePdfResponse } from "@/lib/invoice-pdf";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id); // RLS : uniquement les documents de l'artisan connecté
  if (!invoice) return new Response("Introuvable", { status: 404 });
  return invoicePdfResponse(invoice, isSupabaseConfigured ? await createClient() : null);
}

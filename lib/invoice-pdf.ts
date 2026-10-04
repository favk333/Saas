import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderInvoicePdf, pdfFilename, type Seller } from "./pdf";
import type { InvoiceDetail } from "./types";

const DEMO_SELLER: Seller = {
  company_name: "Tremblay Électrique",
  address: "1200 rue Sainte-Catherine O., Montréal (Québec) H3B 1K9",
  phone: "+15145551234",
  neq: "1171234567",
  rbq_licence: "5678123401",
  tps_number: "123456789RT0001",
  tvq_number: "1234567890TQ0001",
  insurance: "Responsabilité civile Intact, police n° 123456",
};

/**
 * PDF d'une soumission ou d'une facture. `supabase` : client artisan (RLS) ou admin (lien public).
 * Sans client (mode démo), utilise un vendeur fictif et pas de signature.
 */
export async function invoicePdfResponse(invoice: InvoiceDetail, supabase: SupabaseClient | null) {
  let seller = DEMO_SELLER;
  let signature: Uint8Array | null = null;

  if (supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("company_name, address, phone, neq, rbq_licence, tps_number, tvq_number, insurance")
      .eq("id", invoice.user_id)
      .single();
    if (!data) return new Response("Profil introuvable", { status: 404 });
    seller = data;

    if (invoice.signature_path) {
      const { data: blob } = await supabase.storage.from("signatures").download(invoice.signature_path);
      if (blob) signature = new Uint8Array(await blob.arrayBuffer());
    }
  }

  const pdf = await renderInvoicePdf(invoice, seller, signature);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFilename(invoice)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

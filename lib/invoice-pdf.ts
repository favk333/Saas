import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderInvoicePdf, pdfFilename, type Seller } from "./pdf";
import type { InvoiceDetail } from "./types";

const DEMO_SELLER: Seller = {
  company_name: "Dupont Électricité",
  address: "4 rue du Port, 69002 Lyon",
  phone: "+33611223344",
  siret: "12345678900012",
  vat_number: "FR32123456789",
  insurance: "MAAF Pro, contrat n° 123456, France métropolitaine",
};

/**
 * PDF d'un devis/facture. `supabase` : client artisan (RLS) ou admin (lien public).
 * Sans client (mode démo), utilise un vendeur fictif et pas de signature.
 */
export async function invoicePdfResponse(invoice: InvoiceDetail, supabase: SupabaseClient | null) {
  let seller = DEMO_SELLER;
  let signature: Uint8Array | null = null;

  if (supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("company_name, address, phone, siret, vat_number, insurance")
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

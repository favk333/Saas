import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck, FileDown } from "lucide-react";
import { QuoteSummary } from "@/components/quote/quote-summary";
import { OutboxSync } from "@/components/outbox-sync";
import { RemoteSignature } from "@/components/signature/remote-signature";
import { getInvoiceByToken } from "@/lib/data";
import { formatCents } from "@/lib/format";

// Page publique (lien reçu par SMS) : pas d'indexation.
export const metadata: Metadata = { title: "Votre soumission", robots: { index: false, follow: false } };

export default async function RemoteSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await getInvoiceByToken(token);
  if (!found || found.invoice.status === "draft") notFound();
  const { invoice, companyName } = found;

  const number = invoice.invoice_number ? `Facture ${invoice.invoice_number}` : `Soumission ${invoice.quote_number}`;

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-white pb-[calc(100px+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-2 border-b border-line pt-[max(12px,env(safe-area-inset-top))] pb-3 pl-4 pr-1">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{companyName}</p>
          <p className="text-[14px] text-muted tabular-nums">{number}</p>
        </div>
        <a href={`/s/${token}/pdf`} target="_blank"
          className="flex h-12 shrink-0 items-center gap-1.5 rounded-md px-3 text-[14px] font-medium active:bg-canvas">
          <FileDown size={18} strokeWidth={1.75} aria-hidden />
          PDF
        </a>
      </header>

      {/* Garde cette page (et ses JS / CSS) sur le téléphone du client, et envoie une signature en attente. */}
      <OutboxSync warmUrls={[`/s/${token}`]} />

      {invoice.status === "sent" && (
        <>
          <QuoteSummary invoice={invoice} />
          <p className="px-4 pb-3 text-[14px] text-muted">
            Acceptation. En signant, vous acceptez cette soumission d'un montant total de {formatCents(invoice.total_cents)}.
          </p>
          <RemoteSignature token={token} />
        </>
      )}

      {invoice.status === "signed" && (
        <>
          <Done title="Soumission signée. Merci." />
          <QuoteSummary invoice={invoice} />
          <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-lg">
              {invoice.stripe_payment_link_url ? (
                <a href={invoice.stripe_payment_link_url}
                  className="flex h-13 w-full items-center justify-center rounded-md bg-paid text-[16px] font-medium text-white active:opacity-90">
                  Payer {formatCents(invoice.total_cents)}
                </a>
              ) : (
                <p className="py-3 text-center text-[14px] text-muted">Le lien de paiement vous sera envoyé par SMS.</p>
              )}
            </div>
          </div>
        </>
      )}

      {invoice.status === "paid" && (
        <>
          <Done title="Facture réglée. Merci." />
          <QuoteSummary invoice={invoice} />
        </>
      )}
    </div>
  );
}

function Done({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-line px-4 py-4 text-paid">
      <CircleCheck size={20} strokeWidth={1.75} aria-hidden />
      <p className="text-[15px] font-medium">{title}</p>
    </div>
  );
}

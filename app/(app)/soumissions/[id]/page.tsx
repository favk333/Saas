import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileDown } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { InvoiceActions } from "@/components/invoice/invoice-actions";
import { QuoteSummary } from "@/components/quote/quote-summary";
import { getInvoice } from "@/lib/data";
import { formatCents } from "@/lib/format";
import { displayStatus } from "@/lib/types";

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" });

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const status = displayStatus(invoice);
  const isInvoice = Boolean(invoice.invoice_number);

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-white pb-[calc(140px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-line bg-white px-1 pt-[env(safe-area-inset-top)]">
        <Link href="/" aria-label="Retour" className="flex h-12 w-12 items-center justify-center rounded-md active:bg-canvas">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden />
        </Link>
        <h1 className="flex-1 truncate text-[17px] font-semibold tabular-nums">
          {isInvoice ? `Facture ${invoice.invoice_number}` : `Soumission ${invoice.quote_number}`}
        </h1>
        <StatusBadge status={status} />
        <a href={`/soumissions/${invoice.id}/pdf`} target="_blank" aria-label="Télécharger le PDF"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md active:bg-canvas">
          <FileDown size={22} strokeWidth={1.75} aria-hidden />
        </a>
      </header>

      <QuoteSummary invoice={invoice} />

      <dl className="space-y-1 border-t border-line px-4 py-4 text-[14px] text-muted">
        {isInvoice && <div className="flex justify-between"><dt>Soumission</dt><dd className="tabular-nums">{invoice.quote_number}</dd></div>}
        {invoice.signed_at && <div className="flex justify-between"><dt>Signée{invoice.signed_offline ? " (hors ligne)" : ""}</dt><dd>{dateTime(invoice.signed_at)}</dd></div>}
        {invoice.due_at && !invoice.paid_at && <div className="flex justify-between"><dt>Échéance</dt><dd>{dateTime(invoice.due_at)}</dd></div>}
        {invoice.stripe_payment_link_url && invoice.platform_fee_cents ? (
          <div className="flex justify-between"><dt>Commission (au paiement)</dt><dd className="tabular-nums">{formatCents(invoice.platform_fee_cents)}</dd></div>
        ) : null}
        {invoice.paid_at && <div className="flex justify-between text-paid"><dt>Payée</dt><dd>{dateTime(invoice.paid_at)}</dd></div>}
      </dl>

      <InvoiceActions id={invoice.id} status={status} paymentUrl={invoice.stripe_payment_link_url} />
    </div>
  );
}

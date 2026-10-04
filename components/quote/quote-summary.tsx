import { formatCents } from "@/lib/format";
import { TPS_LABEL, TVQ_LABEL } from "@/lib/quote";
import type { InvoiceDetail } from "@/lib/types";

/** Récapitulatif lisible par le client avant signature, et par l'artisan ensuite. */
export function QuoteSummary({ invoice }: { invoice: InvoiceDetail }) {
  return (
    <div className="px-4 py-5">
      <p className="text-[16px] font-medium">{invoice.client.name}</p>
      {invoice.site_address && <p className="mt-0.5 text-[14px] text-muted">{invoice.site_address}</p>}

      <ul className="mt-4 divide-y divide-line border-y border-line">
        {invoice.line_items.map((li) => (
          <li key={li.position} className="flex justify-between gap-4 py-2.5 text-[15px]">
            <span className="min-w-0">{li.description}</span>
            <span className="shrink-0 tabular-nums">{formatCents(li.total_cents)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-3 space-y-1 text-[15px] tabular-nums">
        <div className="flex justify-between text-muted"><dt>Sous-total</dt><dd>{formatCents(invoice.subtotal_cents)}</dd></div>
        {invoice.tax_regime === "qc" ? (
          <>
            <div className="flex justify-between text-muted"><dt>{TPS_LABEL}</dt><dd>{formatCents(invoice.tps_cents)}</dd></div>
            <div className="flex justify-between text-muted"><dt>{TVQ_LABEL}</dt><dd>{formatCents(invoice.tvq_cents)}</dd></div>
          </>
        ) : (
          <div className="text-muted">Taxes non applicables</div>
        )}
        <div className="flex justify-between pt-1 text-[18px] font-semibold"><dt>Total</dt><dd>{formatCents(invoice.total_cents)}</dd></div>
      </dl>
    </div>
  );
}

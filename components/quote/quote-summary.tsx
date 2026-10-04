import { formatCents } from "@/lib/format";
import type { InvoiceDetail } from "@/lib/types";

/** Récapitulatif lisible par le client avant signature, et par l'artisan ensuite. */
export function QuoteSummary({ invoice }: { invoice: InvoiceDetail }) {
  const rate = (invoice.tax_bps / 100).toLocaleString("fr-FR");

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
        <div className="flex justify-between text-muted"><dt>Sous-total HT</dt><dd>{formatCents(invoice.subtotal_cents)}</dd></div>
        {invoice.tax_bps > 0 ? (
          <div className="flex justify-between text-muted"><dt>TVA {rate} %</dt><dd>{formatCents(invoice.tax_cents)}</dd></div>
        ) : (
          <div className="text-muted">TVA non applicable, art. 293 B du CGI</div>
        )}
        <div className="flex justify-between pt-1 text-[18px] font-semibold"><dt>Total TTC</dt><dd>{formatCents(invoice.total_cents)}</dd></div>
      </dl>
    </div>
  );
}

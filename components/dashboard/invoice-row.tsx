import { MessageSquare } from "lucide-react";
import { remindBySms } from "@/app/(app)/actions";
import { formatAgo, formatCents } from "@/lib/format";
import { displayStatus, type DisplayStatus, type Invoice } from "@/lib/types";
import { StatusBadge } from "./status-badge";

function detail(inv: Invoice, status: DisplayStatus, now: Date) {
  const days = (iso: string) => Math.round(Math.abs(new Date(iso).getTime() - now.getTime()) / 86_400_000);
  switch (status) {
    case "sent":
      return inv.sent_at ? `envoyé ${formatAgo(inv.sent_at, now)}` : "";
    case "signed":
      return inv.due_at ? `échéance dans ${days(inv.due_at)} j` : "";
    case "late": {
      const r = inv.reminders_sent;
      return `${inv.due_at ? `${days(inv.due_at)} j de retard` : ""}${r ? ` · ${r} relance${r > 1 ? "s" : ""}` : ""}`;
    }
    case "paid":
      return inv.paid_at ? `payé ${formatAgo(inv.paid_at, now)}` : "";
    default:
      return "";
  }
}

export function InvoiceRow({ invoice, now }: { invoice: Invoice; now: Date }) {
  const status = displayStatus(invoice, now);
  const info = detail(invoice, status, now);
  const canRemind = status === "sent" || status === "signed" || status === "late";

  return (
    <li className="px-4 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="truncate text-[16px] font-medium">{invoice.client.name}</p>
        <p className="shrink-0 text-[16px] font-semibold tabular-nums">{formatCents(invoice.total_cents)}</p>
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-[13px] text-muted">
        <StatusBadge status={status} />
        <span className="tabular-nums">{invoice.invoice_number ?? invoice.quote_number}</span>
        {info && (
          <>
            <span aria-hidden>·</span>
            <span className="truncate">{info}</span>
          </>
        )}
      </div>

      {canRemind && (
        <form action={remindBySms} className="mt-3">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-line text-[15px] font-medium active:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <MessageSquare size={18} strokeWidth={1.75} aria-hidden />
            Relancer par SMS
          </button>
        </form>
      )}
    </li>
  );
}

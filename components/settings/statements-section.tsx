import { FileDown } from "lucide-react";
import { monthLabel, type MonthSummary } from "@/lib/commissions";
import { formatCents } from "@/lib/format";
import { Section } from "./profile-form";

/** Relevés mensuels des commissions (PDF), pour la comptabilité de l'artisan. */
export function StatementsSection({ months }: { months: MonthSummary[] }) {
  if (months.length === 0) return null;
  return (
    <Section title="Relevés des commissions">
      <p className="text-[13px] text-muted">Commissions, TPS et TVQ prélevées par mois, pour vos crédits de taxe.</p>
      <ul className="divide-y divide-line rounded-md border border-line">
        {months.map((m) => (
          <li key={m.month}>
            <a href={`/reglages/releves/${m.month}/pdf`} target="_blank"
              className="flex min-h-12 items-center gap-3 px-3 py-2 active:bg-canvas">
              <span className="flex-1">
                <span className="block text-[15px] font-medium first-letter:uppercase">{monthLabel(m.month)}</span>
                <span className="block text-[13px] text-muted">
                  {m.count} paiement{m.count > 1 ? "s" : ""} · {formatCents(m.total)} prélevés
                </span>
              </span>
              <FileDown size={18} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

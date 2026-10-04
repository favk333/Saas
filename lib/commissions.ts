// Relevé mensuel des commissions de la plateforme, pour l'artisan (crédits de taxe : CTI / RTI).
// Un paiement compte dans le mois où il a été encaissé, à l'heure de Montréal :
// c'est à ce moment que Stripe prélève la commission.

export type CommissionRow = {
  invoice_number: string;
  paid_at: string;
  total_cents: number; // payé par le client
  platform_fee_cents: number; // commission avant taxes
  platform_fee_tps_cents: number | null;
  platform_fee_tvq_cents: number | null;
};

export type MonthSummary = {
  month: string; // "2026-09"
  count: number;
  payments: number;
  fee: number;
  tps: number;
  tvq: number;
  total: number; // commission + taxes, prélevé par Stripe
};

const TZ = "America/Toronto";

/** "2026-10-01T03:30:00Z" → "2026-09" (encore le 30 septembre à Montréal). */
export function monthKey(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

export const isMonth = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** "2026-09" → "septembre 2026" */
export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("fr-CA", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function summarize(month: string, rows: CommissionRow[]): MonthSummary {
  const s = { month, count: rows.length, payments: 0, fee: 0, tps: 0, tvq: 0, total: 0 };
  for (const r of rows) {
    const tps = r.platform_fee_tps_cents ?? 0;
    const tvq = r.platform_fee_tvq_cents ?? 0;
    s.payments += r.total_cents;
    s.fee += r.platform_fee_cents;
    s.tps += tps;
    s.tvq += tvq;
    s.total += r.platform_fee_cents + tps + tvq;
  }
  return s;
}

/** Mois ayant au moins une commission, du plus récent au plus ancien. */
export function monthsOf(rows: CommissionRow[]): MonthSummary[] {
  const byMonth = new Map<string, CommissionRow[]>();
  for (const r of rows) {
    const k = monthKey(r.paid_at);
    byMonth.set(k, [...(byMonth.get(k) ?? []), r]);
  }
  return [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([k, rs]) => summarize(k, rs));
}

export function rowsOfMonth(rows: CommissionRow[], month: string) {
  return rows.filter((r) => monthKey(r.paid_at) === month).sort((a, b) => a.paid_at.localeCompare(b.paid_at));
}

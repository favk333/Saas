// Règles du devis, partagées client (aperçu) / serveur (validation).
// Les arrondis reproduisent ceux de la base (supabase/migrations/0001_init.sql).

export const TAX_RATES = [
  { bps: 2000, label: "20 %" },
  { bps: 1000, label: "10 %" },
  { bps: 550, label: "5,5 %" },
  { bps: 0, label: "Sans" }, // franchise en base (micro-entreprise)
] as const;

export function isTaxRate(bps: number) {
  return TAX_RATES.some((r) => r.bps === bps);
}

/** "1 250,50" | "1250.5" | "80" → centimes. null si invalide. */
export function parseEuros(input: string): number | null {
  const s = input.replace(/[\s\u00a0\u202f€]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return cents <= 100_000_000 ? cents : null;
}

/** "06 12 34 56 78" | "+33612345678" | "0033…" → E.164. null si invalide. */
export function normalizePhone(input: string): string | null {
  let s = input.replace(/[\s.\-()]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  else if (/^0[1-9]\d{8}$/.test(s)) s = "+33" + s.slice(1);
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

export function computeTotals(lineCents: number[], taxBps: number) {
  const subtotal = lineCents.reduce((a, b) => a + b, 0);
  const tax = Math.round((subtotal * taxBps) / 10000);
  return { subtotal, tax, total: subtotal + tax };
}

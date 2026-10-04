// Règles de la soumission, partagées client (aperçu) / serveur (validation).
// Les arrondis reproduisent ceux de la base (supabase/migrations/0005_quebec_taxes.sql).

export type TaxRegime = "qc" | "exempt";

export const TAX_REGIMES: { id: TaxRegime; label: string }[] = [
  { id: "qc", label: "TPS + TVQ" },
  { id: "exempt", label: "Sans taxes" }, // petit fournisseur non inscrit
];

// Taux en cent-millièmes, pour calculer en entiers : TPS 5 %, TVQ 9,975 %.
const TPS_RATE = 5_000;
const TVQ_RATE = 9_975;
export const TPS_LABEL = "TPS (5 %)";
export const TVQ_LABEL = "TVQ (9,975 %)";

export function isTaxRegime(v: unknown): v is TaxRegime {
  return v === "qc" || v === "exempt";
}

/** "1 250,50" | "1250.5" | "80 $" → cents. null si invalide. */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[\s  $]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return cents <= 100_000_000 ? cents : null;
}

/**
 * → E.164.  null si invalide.
 * "514 555-1234" | "1 514 555 1234" (Canada/É.-U.) | "06 12 34 56 78" (France) | "+…" | "00…"
 */
export function normalizePhone(input: string): string | null {
  let s = input.replace(/[\s.\-()]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  else if (/^[2-9]\d{9}$/.test(s)) s = "+1" + s;
  else if (/^1[2-9]\d{9}$/.test(s)) s = "+" + s;
  else if (/^0[1-9]\d{8}$/.test(s)) s = "+33" + s.slice(1);
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

/** Arrondi au cent, demi vers le haut, en entiers (identique à round() de Postgres pour des montants positifs). */
const taxOf = (cents: number, rate: number) => Math.floor((cents * rate + 50_000) / 100_000);

export function computeTotals(lineCents: number[], regime: TaxRegime) {
  const subtotal = lineCents.reduce((a, b) => a + b, 0);
  const tps = regime === "qc" ? taxOf(subtotal, TPS_RATE) : 0;
  const tvq = regime === "qc" ? taxOf(subtotal, TVQ_RATE) : 0;
  return { subtotal, tps, tvq, tax: tps + tvq, total: subtotal + tps + tvq };
}

// ---- Validation d'une soumission (téléphone avant mise en attente, et serveur) ----

export type QuoteFields = {
  clientName: string;
  phone: string;
  siteAddress: string;
  taxRegime: unknown;
  lines: { description: string; price: string }[];
};

export type QuoteInput = {
  clientName: string;
  phone: string; // E.164
  siteAddress: string | null;
  taxRegime: TaxRegime;
  items: { description: string; cents: number }[];
};

export function parseQuoteInput(f: QuoteFields): { input: QuoteInput } | { error: string } {
  const clientName = f.clientName.trim();
  const phone = normalizePhone(f.phone);
  // Les lignes entièrement vides sont ignorées.
  const lines = f.lines
    .map((l) => ({ description: l.description.trim(), price: l.price.trim() }))
    .filter((l) => l.description || l.price);
  const items = lines.map((l) => ({ description: l.description, cents: parseAmount(l.price) }));

  if (!clientName) return { error: "Nom du client manquant." };
  if (!phone) return { error: "Numéro de téléphone invalide." };
  if (!isTaxRegime(f.taxRegime)) return { error: "Régime de taxes invalide." };
  if (items.length === 0) return { error: "Ajoutez au moins une ligne." };
  if (items.some((it) => !it.description)) return { error: "Une ligne n'a pas de description." };
  if (items.some((it) => it.cents === null)) return { error: "Un prix est invalide." };

  return {
    input: {
      clientName,
      phone,
      siteAddress: f.siteAddress.trim() || null,
      taxRegime: f.taxRegime,
      items: items as { description: string; cents: number }[],
    },
  };
}

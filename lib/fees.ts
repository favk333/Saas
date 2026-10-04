// Commission de la plateforme sur les paiements en ligne (Stripe Connect, application fee).
// Réglée par variables d'environnement, côté serveur uniquement :
//   PLATFORM_FEE_BPS          pourcentage en points de base (100 = 1 %), 0 à 2000
//   PLATFORM_FEE_FIXED_CENTS  montant fixe par paiement, en cents
//   PLATFORM_TPS_NUMBER       n° d'inscription TPS de la plateforme (123456789 RT0001)
//   PLATFORM_TVQ_NUMBER       n° d'inscription TVQ de la plateforme (1234567890 TQ0001)
// Sans taux : aucune commission. Avec les deux numéros : TPS + TVQ ajoutées à la commission
// (plateforme inscrite ; artisans au Québec). Stripe ne prend qu'un montant : commission + taxes.

import { computeTotals } from "./quote";

export type FeeConfig = {
  bps: number;
  fixedCents: number;
  /** Numéros d'inscription de la plateforme ; null si elle ne perçoit pas les taxes. */
  taxNumbers: { tps: string; tvq: string } | null;
};

export type FeeBreakdown = {
  base: number; // commission avant taxes
  tps: number;
  tvq: number;
  total: number; // montant prélevé par Stripe (application_fee_amount)
};

const MAX_BPS = 2000; // garde-fou : 20 % maximum
const NONE: FeeBreakdown = { base: 0, tps: 0, tvq: 0, total: 0 };

function readInt(value: string | undefined, max: number) {
  if (!value?.trim()) return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`Commission mal configurée : ${value}`);
  return n;
}

function readTaxNumbers(env: Record<string, string | undefined>) {
  const clean = (v?: string) => (v ?? "").replace(/[\s-]/g, "").toUpperCase();
  const tps = clean(env.PLATFORM_TPS_NUMBER);
  const tvq = clean(env.PLATFORM_TVQ_NUMBER);
  if (!tps && !tvq) return null;
  // Inscrite à l'une mais pas à l'autre : configuration à corriger, pas à deviner.
  if (!/^\d{9}RT\d{4}$/.test(tps)) throw new Error(`N° de TPS de la plateforme invalide : ${env.PLATFORM_TPS_NUMBER ?? "(vide)"}`);
  if (!/^\d{10}TQ\d{4}$/.test(tvq)) throw new Error(`N° de TVQ de la plateforme invalide : ${env.PLATFORM_TVQ_NUMBER ?? "(vide)"}`);
  return { tps, tvq };
}

export function feeConfig(env: Record<string, string | undefined> = process.env): FeeConfig {
  return {
    bps: readInt(env.PLATFORM_FEE_BPS, MAX_BPS),
    fixedCents: readInt(env.PLATFORM_FEE_FIXED_CENTS, 100_000),
    taxNumbers: readTaxNumbers(env),
  };
}

const withTaxes = (base: number, taxed: boolean): FeeBreakdown => {
  if (!taxed) return { base, tps: 0, tvq: 0, total: base };
  const t = computeTotals([base], "qc"); // mêmes taux et arrondis que les soumissions
  return { base, tps: t.tps, tvq: t.tvq, total: t.total };
};

/**
 * Commission sur un paiement de `paymentCents` (montant payé par le client, taxes comprises).
 * Arrondie au cent ; le total prélevé (avec TPS / TVQ) ne dépasse jamais le paiement.
 */
export function platformFee(paymentCents: number, { bps, fixedCents, taxNumbers }: FeeConfig): FeeBreakdown {
  if (paymentCents <= 0 || (bps === 0 && fixedCents === 0)) return NONE;
  const variable = Math.floor((paymentCents * bps + 5_000) / 10_000); // demi-cent vers le haut, en entiers
  let base = Math.min(paymentCents, variable + fixedCents);

  let fee = withTaxes(base, Boolean(taxNumbers));
  if (fee.total > paymentCents) {
    // Plafond : plus grande commission dont le total taxes comprises tient dans le paiement.
    base = Math.floor((paymentCents * 100_000) / 114_975) + 1;
    while (base > 0 && withTaxes(base, true).total > paymentCents) base--;
    fee = withTaxes(base, true);
  }
  return fee;
}

/** "1 % + 0,30 $ (+ TPS et TVQ)", "2,5 %", ou null si aucune commission. */
export function describeFee({ bps, fixedCents, taxNumbers }: FeeConfig) {
  const parts: string[] = [];
  if (bps) parts.push(`${(bps / 100).toLocaleString("fr-CA")} %`);
  if (fixedCents) parts.push(new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(fixedCents / 100));
  if (!parts.length) return null;
  return parts.join(" + ") + (taxNumbers ? " (+ TPS et TVQ)" : "");
}

/** Pour l'affichage : une configuration invalide ne doit pas casser la page (la création du lien, elle, échoue). */
export function feeInfoSafe(): { label: string | null; taxNumbers: FeeConfig["taxNumbers"] } {
  try {
    const cfg = feeConfig();
    return { label: describeFee(cfg), taxNumbers: cfg.taxNumbers };
  } catch {
    return { label: null, taxNumbers: null };
  }
}

/** "123456789RT0001" → "123456789 RT0001" */
export const spacedTaxNumber = (n: string) => n.replace(/^(\d+)([A-Z]{2}\d{4})$/, "$1 $2");

// Commission de la plateforme sur les paiements en ligne (Stripe Connect, application fee).
// Réglée par variables d'environnement, côté serveur uniquement :
//   PLATFORM_FEE_BPS          pourcentage en points de base (100 = 1 %), 0 à 2000
//   PLATFORM_FEE_FIXED_CENTS  montant fixe par paiement, en cents
// Sans ces variables : aucune commission.

export type FeeConfig = { bps: number; fixedCents: number };

const MAX_BPS = 2000; // garde-fou : 20 % maximum

function readInt(value: string | undefined, max: number) {
  if (!value?.trim()) return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`Commission mal configurée : ${value}`);
  return n;
}

export function feeConfig(env: Record<string, string | undefined> = process.env): FeeConfig {
  return {
    bps: readInt(env.PLATFORM_FEE_BPS, MAX_BPS),
    fixedCents: readInt(env.PLATFORM_FEE_FIXED_CENTS, 100_000),
  };
}

/** Commission sur un paiement de `totalCents` (taxes comprises), arrondie au cent, jamais supérieure au paiement. */
export function platformFee(totalCents: number, { bps, fixedCents }: FeeConfig) {
  if (totalCents <= 0 || (bps === 0 && fixedCents === 0)) return 0;
  const variable = Math.floor((totalCents * bps + 5_000) / 10_000); // demi-cent vers le haut, en entiers
  return Math.min(totalCents, variable + fixedCents);
}

/** "1 % + 0,30 $", "2,5 %", "0,50 $", ou null si aucune commission. */
export function describeFee({ bps, fixedCents }: FeeConfig) {
  const parts: string[] = [];
  if (bps) parts.push(`${(bps / 100).toLocaleString("fr-CA")} %`);
  if (fixedCents) parts.push(new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(fixedCents / 100));
  return parts.length ? parts.join(" + ") : null;
}

/** Pour l'affichage : une configuration invalide ne doit pas casser la page (la création du lien, elle, échoue). */
export function feeLabelSafe() {
  try {
    return describeFee(feeConfig());
  } catch {
    return null;
  }
}

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatCents(cents: number) {
  return eur.format(cents / 100);
}

const day = 86_400_000;

/** "aujourd'hui", "hier", "il y a 4 j", puis "12 sept." au-delà de 30 jours. */
export function formatAgo(iso: string, now = new Date()) {
  const d = Math.floor((now.getTime() - new Date(iso).getTime()) / day);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return "hier";
  if (d < 30) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

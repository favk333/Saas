// Identifiants d'entreprise au Québec, partagés client / serveur.

const digits = (v: string) => v.replace(/[\s\-.]/g, "");

/** NEQ, numéro d'entreprise du Québec : 10 chiffres. null si vide, false si invalide. */
export function normalizeNeq(input: string): string | null | false {
  const s = digits(input);
  if (!s) return null;
  return /^\d{10}$/.test(s) ? s : false;
}

/** Licence RBQ : 10 chiffres, souvent écrits 1234-5678-90. null si vide, false si invalide. */
export function normalizeRbq(input: string): string | null | false {
  const s = digits(input);
  if (!s) return null;
  return /^\d{10}$/.test(s) ? s : false;
}

/** "1234567890" → "1234-5678-90" */
export const formatRbq = (n: string) => n.replace(/^(\d{4})(\d{4})(\d{2})$/, "$1-$2-$3");

import { formatCents } from "./format";

// Relances automatiques : J+3 et J+7 après la signature (= émission de la facture).
export const REMINDER_DAYS = [3, 7] as const;

const DAY = 86_400_000;

/**
 * Numéro de la relance automatique à envoyer maintenant (0 = J+3, 1 = J+7), ou null.
 * Une relance manuelle de moins de 24 h repousse l'envoi automatique au lendemain.
 */
export function dueReminder(
  inv: { signed_at: string | null; reminders_sent: number; last_reminder_at: string | null },
  now = new Date(),
): number | null {
  const step = inv.reminders_sent;
  if (!inv.signed_at || step >= REMINDER_DAYS.length) return null;
  if (now.getTime() - new Date(inv.signed_at).getTime() < REMINDER_DAYS[step] * DAY) return null;
  if (inv.last_reminder_at && now.getTime() - new Date(inv.last_reminder_at).getTime() < DAY) return null;
  return step;
}

type SmsInput = { company: string; number: string; totalCents: number; url: string };

const from = (company: string) => (company ? ` de ${company}` : "");

/** Ton amical, une seule info, un seul lien. */
export function reminderSms(step: number, { company, number, totalCents, url }: SmsInput) {
  const amount = formatCents(totalCents);
  if (step === 0) {
    return `Bonjour, petit rappel : la facture ${number}${from(company)} (${amount}) est en attente de règlement. Paiement en ligne : ${url}`;
  }
  return `Bonjour, la facture ${number}${from(company)} (${amount}) arrive à échéance. Vous pouvez la régler ici : ${url} Merci !`;
}

export function signatureReminderSms({ company, number, totalCents, url }: SmsInput) {
  return `Bonjour, votre soumission ${number}${from(company)} (${formatCents(totalCents)}) attend votre signature : ${url}`;
}

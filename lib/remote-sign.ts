import "server-only";
import { getInvoiceByToken } from "./data";
import { ensurePaymentLink } from "./payments";
import { recordSignature } from "./signature";
import { createAdminClient } from "./supabase/admin";

export type RemoteSignResult =
  | { ok: true }
  | { ok: false; permanent: boolean; error: string };

/**
 * Signature par le client, depuis le lien reçu par SMS (/s/[token]).
 * Rejouable : si la soumission est déjà signée (renvoi après une coupure), c'est un succès.
 * `signedAt` : heure de la signature faite hors ligne sur le téléphone du client.
 */
export async function signRemoteByToken(token: string, png: Buffer, signedAt?: string): Promise<RemoteSignResult> {
  const found = await getInvoiceByToken(token);
  if (!found) return { ok: false, permanent: true, error: "Lien de signature inconnu." };
  const { invoice } = found;
  if (invoice.status === "signed" || invoice.status === "paid") return { ok: true };
  if (invoice.status !== "sent") return { ok: false, permanent: true, error: "Cette soumission n'est plus signable." };

  const admin = createAdminClient();
  try {
    const ok = await recordSignature(admin, invoice, png, "remote", ["sent"], signedAt ? { signedAt } : undefined);
    if (!ok) {
      // Signée entre-temps par une autre requête (renvoi simultané) : c'est réglé.
      const again = await getInvoiceByToken(token);
      const done = again?.invoice.status === "signed" || again?.invoice.status === "paid";
      if (!done) return { ok: false, permanent: true, error: "Cette soumission n'est plus signable." };
    }
  } catch {
    return { ok: false, permanent: false, error: "Enregistrement impossible. Réessayez." };
  }

  // Le client signe à distance : on lui propose de payer tout de suite.
  // Si Stripe échoue, l'artisan pourra générer le lien depuis l'app.
  await ensurePaymentLink(admin, invoice.id).catch(() => null);
  return { ok: true };
}

import "server-only";
import { stripe } from "./stripe";
import { createAdminClient } from "./supabase/admin";

const BUCKET = "signatures";

/** Signatures de l'artisan : signatures/<user_id>/… (le stockage n'est pas effacé par la cascade SQL). */
async function removeSignatures(admin: ReturnType<typeof createAdminClient>, userId: string) {
  for (let round = 0; round < 200; round++) {
    const { data, error } = await admin.storage.from(BUCKET).list(userId, { limit: 100 });
    if (error) throw error;
    if (!data?.length) return;
    const { error: rmError } = await admin.storage.from(BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
    if (rmError) throw rmError;
  }
  throw new Error("Signatures : suppression inachevée");
}

/** Liens de paiement encore ouverts (factures non payées), lus avant que la cascade ne les efface. */
async function openPaymentLinks(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin
    .from("invoices")
    .select("stripe_payment_link_id")
    .eq("user_id", userId)
    .neq("status", "paid")
    .not("stripe_payment_link_id", "is", null);
  return (data ?? []).map((inv) => inv.stripe_payment_link_id as string);
}

/**
 * Désactivés pour qu'un client ne paie pas une facture qui n'existe plus. Au mieux : un échec est
 * journalisé sans bloquer (l'argent irait de toute façon au compte Stripe de l'artisan).
 */
async function deactivatePaymentLinks(links: string[], accountId: string | null) {
  if (!accountId || !links.length || !process.env.STRIPE_SECRET_KEY) return;
  await Promise.all(
    links.map((id) =>
      stripe()
        .paymentLinks.update(id, { active: false }, { stripeAccount: accountId })
        .catch((e) => console.error("Compte supprimé : lien de paiement non désactivé", id, e)),
    ),
  );
}

/**
 * Supprime définitivement le compte. La suppression de auth.users efface en cascade, en une
 * transaction, le profil, les clients, les soumissions / factures et leurs lignes.
 * Ordre : les signatures d'abord (Supabase refuse de supprimer un utilisateur propriétaire de
 * fichiers), les liens de paiement après (si la suppression échoue, les factures restent payables).
 * Le compte Stripe de l'artisan n'est pas touché : il lui appartient (compte Standard),
 * avec ses virements et son historique.
 */
export async function deleteAccount(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("stripe_account_id").eq("id", userId).maybeSingle();
  const links = await openPaymentLinks(admin, userId);
  await removeSignatures(admin, userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
  await deactivatePaymentLinks(links, (profile?.stripe_account_id as string | null) ?? null);
}

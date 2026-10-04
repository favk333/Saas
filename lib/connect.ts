import "server-only";
import { createConnectAccount, createOnboardingLink, getChargesEnabled } from "./stripe";
import { createAdminClient } from "./supabase/admin";

export function appUrl(fallbackOrigin?: string) {
  return process.env.NEXT_PUBLIC_APP_URL ?? fallbackOrigin ?? "";
}

/** URL d'onboarding Stripe pour l'artisan ; crée son compte connecté au premier appel. */
export async function onboardingUrl(user: { id: string; email: string | null }, origin?: string) {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("company_name, stripe_account_id")
    .eq("id", user.id)
    .single();
  if (error) throw error;

  let accountId = profile.stripe_account_id as string | null;
  if (!accountId) {
    const account = await createConnectAccount({ userId: user.id, email: user.email, companyName: profile.company_name });
    accountId = account.id;
    await admin.from("profiles").update({ stripe_account_id: accountId }).eq("id", user.id);
  }
  return createOnboardingLink(accountId, appUrl(origin));
}

/** Relit le statut chez Stripe (retour d'onboarding) et le met en cache dans le profil. */
export async function syncStripeStatus(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("stripe_account_id").eq("id", userId).single();
  if (!profile?.stripe_account_id) return false;
  const { chargesEnabled } = await getChargesEnabled(profile.stripe_account_id);
  await admin.from("profiles").update({ stripe_charges_enabled: chargesEnabled }).eq("id", userId);
  return chargesEnabled;
}

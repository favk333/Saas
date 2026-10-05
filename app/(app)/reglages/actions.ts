"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { onboardingUrl } from "@/lib/connect";
import { checkNewPassword, updatePassword } from "@/lib/password";
import { normalizeNeq, normalizeRbq } from "@/lib/identifiers";
import { isTaxRegime, normalizePhone } from "@/lib/quote";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient, getUser } from "@/lib/supabase/server";

export type SettingsState = { error: string | null; done?: boolean };

const DEMO = "Mode démo : configurez Supabase (.env.local).";

export async function saveProfile(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const companyName = String(formData.get("companyName") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const neq = normalizeNeq(String(formData.get("neq") ?? ""));
  const rbqLicence = normalizeRbq(String(formData.get("rbqLicence") ?? ""));
  const address = String(formData.get("address") ?? "").trim() || null;
  const tpsNumber = String(formData.get("tpsNumber") ?? "").replace(/[\s-]/g, "").toUpperCase() || null;
  const tvqNumber = String(formData.get("tvqNumber") ?? "").replace(/[\s-]/g, "").toUpperCase() || null;
  const insurance = String(formData.get("insurance") ?? "").trim() || null;
  const taxRegime = formData.get("taxRegime");

  if (!companyName) return { error: "Nom de l'entreprise manquant." };
  if (companyName.length > 80) return { error: "Nom trop long (80 caractères max)." };
  if (rawPhone && !phone) return { error: "Numéro de téléphone invalide." };
  if (neq === false) return { error: "Le NEQ compte 10 chiffres." };
  if (rbqLicence === false) return { error: "La licence RBQ compte 10 chiffres (ex. 1234-5678-90)." };
  if (tpsNumber && !/^\d{9}RT\d{4}$/.test(tpsNumber)) return { error: "N° de TPS invalide (ex. 123456789 RT0001)." };
  if (tvqNumber && !/^\d{10}TQ\d{4}$/.test(tvqNumber)) return { error: "N° de TVQ invalide (ex. 1234567890 TQ0001)." };
  if (insurance && insurance.length > 200) return { error: "Assurance : 200 caractères max." };
  if (!isTaxRegime(taxRegime)) return { error: "Régime de taxes invalide." };
  if (taxRegime === "qc" && (!tpsNumber || !tvqNumber)) {
    return { error: "Numéros de TPS et de TVQ requis pour facturer les taxes." };
  }
  if (!isSupabaseConfigured) return { error: DEMO };

  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ company_name: companyName, phone, neq, rbq_licence: rbqLicence, address, tps_number: tpsNumber, tvq_number: tvqNumber, insurance, default_tax_regime: taxRegime })
    .eq("id", user.id);
  if (error) return { error: "Enregistrement impossible. Réessayez." };

  revalidatePath("/", "layout");
  if (formData.get("welcome")) redirect("/");
  return { error: null, done: true };
}

export async function startStripeOnboarding(_prev: SettingsState): Promise<SettingsState> {
  if (!isSupabaseConfigured) return { error: DEMO };
  const user = await getUser(await createClient());
  if (!user) redirect("/login");

  let url: string;
  try {
    const h = await headers();
    url = await onboardingUrl(user, `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`);
  } catch {
    return { error: "Stripe indisponible. Réessayez dans un instant." };
  }
  redirect(url);
}

export async function signOut() {
  if (isSupabaseConfigured) await (await createClient()).auth.signOut();
  redirect("/login");
}

/** Définit ou change le mot de passe (comptes créés par lien magique : ils n'en ont pas). */
export async function setPassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const password = String(formData.get("password") ?? "");
  const invalid = checkNewPassword(password, String(formData.get("confirm") ?? ""));
  if (invalid) return { error: invalid };
  if (!isSupabaseConfigured) return { error: DEMO };

  const error = await updatePassword(await createClient(), password);
  return error ? { error } : { error: null, done: true };
}

export type EmailState = { error: string | null; pendingEmail?: string };

/**
 * Changement d'adresse e-mail. Supabase envoie un lien de confirmation (aux deux adresses si
 * « Secure email change » est actif) ; le retour passe par /auth/email.
 */
export async function changeEmail(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Adresse e-mail invalide." };
  if (!isSupabaseConfigured) return { error: DEMO };

  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) redirect("/login");
  if (user.email?.toLowerCase() === email) return { error: "C'est déjà votre adresse." };

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${origin}/auth/email` });
  if (error) {
    if (error.code === "email_exists") return { error: "Cette adresse est déjà utilisée par un autre compte." };
    if (error.code === "email_address_invalid") return { error: "Adresse e-mail refusée. Vérifiez-la." };
    if (error.status === 429 || error.code?.startsWith("over_")) return { error: "Trop de demandes. Réessayez dans quelques minutes." };
    return { error: "Changement impossible pour le moment. Réessayez." };
  }
  revalidatePath("/reglages");
  return { error: null, pendingEmail: email };
}

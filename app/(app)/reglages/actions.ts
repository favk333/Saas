"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { onboardingUrl } from "@/lib/connect";
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
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "8 caractères minimum." };
  if (password !== confirm) return { error: "Les deux mots de passe ne correspondent pas." };
  if (!isSupabaseConfigured) return { error: DEMO };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "weak_password") return { error: "Mot de passe trop faible. Choisissez-en un plus long." };
    if (error.code === "same_password") return { error: "C'est déjà votre mot de passe." };
    if (error.code === "reauthentication_needed") return { error: "Reconnectez-vous, puis réessayez." };
    return { error: "Enregistrement impossible. Réessayez." };
  }
  return { error: null, done: true };
}

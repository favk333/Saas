"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { onboardingUrl } from "@/lib/connect";
import { isTaxRate, normalizePhone } from "@/lib/quote";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient, getUser } from "@/lib/supabase/server";

export type SettingsState = { error: string | null; done?: boolean };

const DEMO = "Mode démo : configurez Supabase (.env.local).";

export async function saveProfile(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const companyName = String(formData.get("companyName") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const siret = String(formData.get("siret") ?? "").replace(/\s/g, "") || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const taxBps = Number(formData.get("taxBps"));

  if (!companyName) return { error: "Nom de l'entreprise manquant." };
  if (companyName.length > 80) return { error: "Nom trop long (80 caractères max)." };
  if (rawPhone && !phone) return { error: "Numéro de téléphone invalide." };
  if (siret && !/^\d{14}$/.test(siret)) return { error: "Le SIRET compte 14 chiffres." };
  if (!isTaxRate(taxBps)) return { error: "Taux de TVA invalide." };
  if (!isSupabaseConfigured) return { error: DEMO };

  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ company_name: companyName, phone, siret, address, default_tax_bps: taxBps })
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

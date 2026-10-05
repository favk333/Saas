"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null; sent?: boolean; resetSent?: boolean };

const DEMO = "Mode démo : connexion désactivée (configurez Supabase).";

/** Messages lisibles pour les erreurs d'authentification Supabase. */
function authMessage(error: { code?: string; status?: number; message?: string }) {
  switch (error.code) {
    case "invalid_credentials":
      return "E-mail ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Adresse e-mail pas encore confirmée. Ouvrez l'e-mail de confirmation, ou recevez un lien de connexion.";
    case "user_banned":
      return "Ce compte est désactivé.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives. Réessayez dans quelques minutes.";
  }
  if (error.status === 429) return "Trop de tentatives. Réessayez dans quelques minutes.";
  return "Connexion impossible pour le moment. Réessayez.";
}

/** Connexion par e-mail + mot de passe. */
export async function signInWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email.includes("@")) return { error: "Adresse e-mail invalide." };
  if (!password) return { error: "Mot de passe manquant." };
  if (!isSupabaseConfigured) return { error: DEMO };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authMessage(error) };
  redirect("/");
}

async function appOrigin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/**
 * Mot de passe oublié : e-mail avec un lien vers /auth/reset, puis /reinitialiser.
 * Même réponse que le compte existe ou non (pas de divulgation des comptes).
 */
export async function requestPasswordReset(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "Saisissez votre e-mail pour réinitialiser le mot de passe." };
  if (!isSupabaseConfigured) return { error: DEMO };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await appOrigin()}/auth/reset` });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) return { error: authMessage(error) };
  if (error) return { error: "Envoi impossible pour le moment. Réessayez." };
  return { error: null, resetSent: true };
}

/** Lien de connexion par e-mail : comptes sans mot de passe, première connexion. */
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "Saisissez votre e-mail pour recevoir le lien." };
  if (!isSupabaseConfigured) return { error: DEMO };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${await appOrigin()}/auth/callback` } });
  if (error) return { error: authMessage(error) };
  return { error: null, sent: true };
}

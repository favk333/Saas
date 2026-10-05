"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured, supabaseConfigIssues } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null; sent?: boolean; resetSent?: boolean };

const DEMO = "Mode démo : connexion désactivée (configurez Supabase).";

type AuthErrorLike = { code?: string; status?: number; message?: string; name?: string };

/** Message lisible pour les erreurs d'authentification Supabase. */
function friendly(error: AuthErrorLike) {
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
  if (error.name === "AuthRetryableFetchError" || !error.status) return "Serveur Supabase injoignable.";
  return "Connexion impossible.";
}

/** Message lisible suivi de l'erreur exacte renvoyée par Supabase (message, code, statut HTTP). */
function authMessage(error: AuthErrorLike) {
  const meta = [error.code && `code ${error.code}`, error.status && `HTTP ${error.status}`].filter(Boolean).join(", ");
  const detail = `${error.message || error.name || "erreur inconnue"}${meta ? ` (${meta})` : ""}`;
  console.error("Supabase auth :", detail);
  const config = supabaseConfigIssues();
  return [friendly(error), `Supabase : ${detail}`, ...config.map((c) => `Configuration : ${c}`)].join("\n");
}

/** Exception levée avant même la réponse de Supabase (URL invalide, réseau…). */
const thrown = (e: unknown) => authMessage(e instanceof Error ? { message: e.message, name: e.name } : { message: String(e) });

/** Connexion par e-mail + mot de passe. */
export async function signInWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email.includes("@")) return { error: "Adresse e-mail invalide." };
  if (!password) return { error: "Mot de passe manquant." };
  if (!isSupabaseConfigured) return { error: DEMO };

  try {
    const { error } = await (await createClient()).auth.signInWithPassword({ email, password });
    if (error) return { error: authMessage(error) };
  } catch (e) {
    return { error: thrown(e) };
  }
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

  try {
    const { error } = await (await createClient()).auth.resetPasswordForEmail(email, { redirectTo: `${await appOrigin()}/auth/reset` });
    if (error) return { error: authMessage(error) }; // Supabase ne signale pas les comptes inconnus : rien n'est divulgué
  } catch (e) {
    return { error: thrown(e) };
  }
  return { error: null, resetSent: true };
}

/** Lien de connexion par e-mail : comptes sans mot de passe, première connexion. */
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "Saisissez votre e-mail pour recevoir le lien." };
  if (!isSupabaseConfigured) return { error: DEMO };

  try {
    const { error } = await (await createClient()).auth.signInWithOtp({ email, options: { emailRedirectTo: `${await appOrigin()}/auth/callback` } });
    if (error) return { error: authMessage(error) };
  } catch (e) {
    return { error: thrown(e) };
  }
  return { error: null, sent: true };
}

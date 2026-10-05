import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const MIN_PASSWORD = 8;

/** Vérifie le nouveau mot de passe et sa confirmation. Message d'erreur, ou null si valide. */
export function checkNewPassword(password: string, confirm: string) {
  if (password.length < MIN_PASSWORD) return `${MIN_PASSWORD} caractères minimum.`;
  if (password !== confirm) return "Les deux mots de passe ne correspondent pas.";
  return null;
}

/** Enregistre le mot de passe de l'utilisateur connecté. Message d'erreur, ou null si enregistré. */
export async function updatePassword(supabase: SupabaseClient, password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (!error) return null;
  switch (error.code) {
    case "weak_password":
      return "Mot de passe trop faible. Choisissez-en un plus long.";
    case "same_password":
      return "C'est déjà votre mot de passe.";
    case "reauthentication_needed":
    case "session_not_found":
    case "session_expired":
      return "Session expirée. Recommencez depuis la page de connexion.";
  }
  return "Enregistrement impossible. Réessayez.";
}

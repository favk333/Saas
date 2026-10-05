"use server";

import { redirect } from "next/navigation";
import { checkNewPassword, updatePassword } from "@/lib/password";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient, getUserId } from "@/lib/supabase/server";

export type ResetState = { error: string | null };

/** Nouveau mot de passe, avec la session ouverte par le lien de réinitialisation. */
export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const password = String(formData.get("password") ?? "");
  const invalid = checkNewPassword(password, String(formData.get("confirm") ?? ""));
  if (invalid) return { error: invalid };
  if (!isSupabaseConfigured) return { error: "Mode démo : réinitialisation désactivée." };

  const supabase = await createClient();
  if (!(await getUserId(supabase))) redirect("/login?error=reset");
  const error = await updatePassword(supabase, password);
  if (error) return { error };
  redirect("/");
}

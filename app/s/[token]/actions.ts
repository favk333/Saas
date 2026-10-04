"use server";

import { redirect } from "next/navigation";
import type { SignatureState } from "@/components/signature/signature-form";
import { signRemoteByToken } from "@/lib/remote-sign";
import { decodeSignature } from "@/lib/signature";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function signRemote(_prev: SignatureState, formData: FormData): Promise<SignatureState> {
  const token = String(formData.get("token"));
  const png = decodeSignature(formData.get("signature"));
  if (!png) return { error: "Signature illisible. Recommencez." };
  if (!isSupabaseConfigured) return { error: "Démonstration : signature non enregistrée." };

  const result = await signRemoteByToken(token, png);
  if (!result.ok) return { error: result.error };
  redirect(`/s/${token}`);
}

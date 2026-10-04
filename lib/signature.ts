import "server-only";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

const PREFIX = "data:image/png;base64,";

/** Décode le PNG envoyé par le pad. null si absent, mal formé ou trop lourd. */
export function decodeSignature(value: FormDataEntryValue | null): Buffer | null {
  if (typeof value !== "string" || !value.startsWith(PREFIX) || value.length > 700_000) return null;
  const png = Buffer.from(value.slice(PREFIX.length), "base64");
  // Signature PNG : 89 50 4E 47
  return png.length > 100 && png.readUInt32BE(0) === 0x89504e47 ? png : null;
}

/**
 * Enregistre la signature et passe la soumission en "signed".
 * Le trigger SQL attribue alors le numéro de facture et l'échéance.
 * Renvoie false si la soumission n'était plus signable (déjà signée, annulée…).
 */
export async function recordSignature(
  supabase: SupabaseClient,
  invoice: { id: string; user_id: string },
  png: Buffer,
  channel: "on_site" | "remote",
  fromStatuses: string[],
) {
  const path = `${invoice.user_id}/${invoice.id}.png`;
  const { error: uploadError } = await supabase.storage
    .from("signatures")
    .upload(path, png, { contentType: "image/png", upsert: true });
  if (uploadError) throw uploadError;

  const h = await headers();
  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: "signed",
      signed_via: channel,
      signature_path: path,
      signature_ip: h.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
      signature_user_agent: h.get("user-agent")?.slice(0, 300) ?? null,
    })
    .eq("id", invoice.id)
    .in("status", fromStatuses) // garde-fou contre une double signature
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

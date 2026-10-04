import { NextResponse, type NextRequest } from "next/server";
import { signRemoteByToken } from "@/lib/remote-sign";
import { clampSignedAt, decodeSignature } from "@/lib/signature";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

/**
 * Envoi différé d'une signature faite hors ligne par le client, sur le lien /s/[token].
 * Public : le jeton du lien suffit (comme pour la page). Mêmes codes que /api/offline-sync :
 * 2xx envoyé · 502 / 503 nouvel essai plus tard · 422 échec définitif.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Démonstration : envoi impossible." }, { status: 503 });

  let body: { token?: unknown; signature?: unknown; signedAt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Données illisibles." }, { status: 422 });
  }
  const token = typeof body.token === "string" && /^[0-9a-f]{32}$/.test(body.token) ? body.token : null;
  if (!token) return NextResponse.json({ error: "Lien de signature invalide." }, { status: 422 });
  const png = decodeSignature(typeof body.signature === "string" ? body.signature : null);
  if (!png) return NextResponse.json({ error: "Signature illisible." }, { status: 422 });

  const result = await signRemoteByToken(token, png, clampSignedAt(body.signedAt));
  if (result.ok) return NextResponse.json({ status: "signed" });
  return NextResponse.json({ error: result.error }, { status: result.permanent ? 422 : 502 });
}

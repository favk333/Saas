import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Retour des liens « changement d'adresse ». Destination fixe : Réglages (ou la connexion).
 * - ?code=…              : changement terminé ; on ouvre la session avec la nouvelle adresse.
 * - ?message=… (ou rien) : une adresse confirmée, il reste l'autre (« Secure email change »).
 * - ?error=…             : lien expiré ou invalide.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (params.get("error") || params.get("error_code")) return to("/reglages?email=erreur");

  const code = params.get("code");
  if (!code) return to("/reglages?email=attente");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  // Échec de l'échange (autre appareil, lien réutilisé) : l'adresse a pu changer quand même,
  // côté Supabase, au moment de la confirmation. On invite à se reconnecter.
  return error ? to("/login?error=email") : to("/reglages?email=ok");
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Retour du lien « mot de passe oublié » : ouvre une session de récupération,
// puis l'artisan choisit son nouveau mot de passe. Destination fixe (pas de redirection ouverte).
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    // Échoue si le lien a expiré, a déjà servi, ou est ouvert sur un autre appareil (PKCE).
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/reinitialiser", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=reset", request.url));
}

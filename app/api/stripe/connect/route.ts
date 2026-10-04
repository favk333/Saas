import { NextResponse, type NextRequest } from "next/server";
import { onboardingUrl, syncStripeStatus } from "@/lib/connect";
import { createClient, getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Retours de l'onboarding Stripe :
 * - mode=return  : l'artisan a quitté le formulaire → on relit son statut.
 * - mode=refresh : le lien a expiré → on en génère un nouveau.
 */
export async function GET(request: NextRequest) {
  const user = await getUser(await createClient());
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  if (request.nextUrl.searchParams.get("mode") === "refresh") {
    try {
      return NextResponse.redirect(await onboardingUrl(user, request.nextUrl.origin));
    } catch {
      return NextResponse.redirect(new URL("/reglages?stripe=erreur", request.url));
    }
  }

  await syncStripeStatus(user.id).catch(() => null);
  return NextResponse.redirect(new URL("/reglages", request.url));
}

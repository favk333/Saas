import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Deux endpoints possibles dans Stripe : compte plateforme et comptes Connect.
const SECRETS = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[];

function verify(body: string, signature: string): Stripe.Event | null {
  for (const secret of SECRETS) {
    try {
      return stripe().webhooks.constructEvent(body, signature, secret);
    } catch {}
  }
  return null;
}

/** Paiement reçu → facture "paid" (le trigger SQL date paid_at, les relances s'arrêtent). */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  const event = signature ? verify(body, signature) : null;
  if (!event) return NextResponse.json({ error: "invalid signature" }, { status: 400 });

  const paid =
    (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") ||
    event.type === "checkout.session.async_payment_succeeded";
  if (!paid) return NextResponse.json({ received: true });

  const session = event.data.object as Stripe.Checkout.Session;
  const admin = createAdminClient();
  const paymentLinkId = typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id;

  let query = admin.from("invoices").update({ status: "paid" }).eq("status", "signed");
  if (session.metadata?.invoice_id) query = query.eq("id", session.metadata.invoice_id);
  else if (paymentLinkId) query = query.eq("stripe_payment_link_id", paymentLinkId);
  else return NextResponse.json({ received: true, ignored: "no invoice reference" });

  const { error } = await query;
  // 500 → Stripe renverra l'événement plus tard.
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ received: true });
}

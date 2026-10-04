import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe non configuré");
  return (client ??= new Stripe(key));
}

/**
 * Lien de paiement permanent (contrairement à une session Checkout qui expire en 24 h) :
 * réutilisable dans les relances J+3 / J+7.
 * Avec Stripe Connect, l'encaissement se fait directement sur le compte de l'artisan.
 */
export async function createPaymentLink(input: {
  invoiceId: string;
  invoiceNumber: string;
  totalCents: number;
  currency: string;
  stripeAccountId: string | null;
}) {
  const metadata = { invoice_id: input.invoiceId };
  return stripe().paymentLinks.create(
    {
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            unit_amount: input.totalCents,
            product_data: { name: `Facture ${input.invoiceNumber}` },
          },
        },
      ],
      metadata,
      payment_intent_data: { metadata },
      restrictions: { completed_sessions: { limit: 1 } }, // une facture = un paiement
    },
    {
      idempotencyKey: `payment-link-${input.invoiceId}`,
      ...(input.stripeAccountId ? { stripeAccount: input.stripeAccountId } : {}),
    },
  );
}

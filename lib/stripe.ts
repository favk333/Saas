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
 * Encaissement direct sur le compte Stripe Connect de l'artisan.
 */
export async function createPaymentLink(input: {
  invoiceId: string;
  invoiceNumber: string;
  totalCents: number;
  currency: string;
  stripeAccountId: string;
  applicationFeeCents: number; // commission de la plateforme, 0 si aucune
}) {
  const metadata = { invoice_id: input.invoiceId };
  const fee = input.applicationFeeCents;
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
      // Prélevée sur le paiement du client et versée au compte de la plateforme ; le reste va à l'artisan.
      ...(fee > 0 ? { application_fee_amount: fee } : {}),
    },
    // La commission fait partie de la clé : si le taux change, Stripe ne confond pas les deux demandes.
    { idempotencyKey: `payment-link-${input.invoiceId}-fee-${fee}`, stripeAccount: input.stripeAccountId },
  );
}

/**
 * Compte Stripe "standard" : l'artisan possède son compte (virements, litiges,
 * tableau de bord Stripe). Les paiements sont des "direct charges" sur ce compte.
 */
export async function createConnectAccount(input: { userId: string; email: string | null; companyName: string }) {
  return stripe().accounts.create(
    {
      type: "standard",
      country: "CA",
      email: input.email ?? undefined,
      business_profile: { name: input.companyName || undefined },
      metadata: { user_id: input.userId },
    },
    { idempotencyKey: `connect-account-${input.userId}` },
  );
}

/** Lien à usage unique vers le formulaire d'activation hébergé par Stripe. */
export async function createOnboardingLink(accountId: string, appUrl: string) {
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl}/api/stripe/connect?mode=refresh`,
    return_url: `${appUrl}/api/stripe/connect?mode=return`,
  });
  return link.url;
}

export async function getChargesEnabled(accountId: string) {
  const account = await stripe().accounts.retrieve(accountId);
  return { chargesEnabled: account.charges_enabled, detailsSubmitted: account.details_submitted };
}

"use client";

import { useActionState } from "react";
import { ArrowUpRight, CircleCheck } from "lucide-react";
import { startStripeOnboarding, type SettingsState } from "@/app/(app)/reglages/actions";
import { Section } from "./profile-form";

const button =
  "flex h-12 w-full items-center justify-center gap-2 rounded-md border border-line text-[15px] font-medium active:bg-canvas disabled:opacity-50";

export function PaymentsSection({ accountId, enabled, failed }: { accountId: string | null; enabled: boolean; failed: boolean }) {
  const [state, action, pending] = useActionState<SettingsState>(startStripeOnboarding, { error: null });
  const error = state.error ?? (failed ? "Stripe indisponible. Réessayez dans un instant." : null);

  if (enabled) {
    return (
      <Section title="Paiements en ligne">
        <p className="flex items-center gap-2 text-[15px] font-medium text-paid">
          <CircleCheck size={18} strokeWidth={1.75} aria-hidden />
          Activés. Les paiements arrivent sur votre compte Stripe.
        </p>
        <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className={button}>
          Ouvrir Stripe
          <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden />
        </a>
      </Section>
    );
  }

  return (
    <Section title="Paiements en ligne">
      <p className="text-[15px]">
        {accountId
          ? "Activation incomplète. Stripe attend encore des informations."
          : "Non activés. Vos clients ne peuvent pas payer par carte."}
      </p>
      <p className="text-[13px] text-muted">
        Compte Stripe à votre nom : identité, IBAN. Environ 5 minutes. Vous êtes payé directement.
      </p>
      <form action={action}>
        <button className={button} disabled={pending}>
          {pending ? "Redirection…" : accountId ? "Terminer l'activation" : "Activer les paiements"}
          {!pending && <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden />}
        </button>
      </form>
      {error && <p role="alert" className="text-[14px] text-late">{error}</p>}
    </Section>
  );
}

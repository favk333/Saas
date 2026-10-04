"use client";

import { useActionState } from "react";
import { ArrowUpRight, CircleCheck } from "lucide-react";
import { startStripeOnboarding, type SettingsState } from "@/app/(app)/reglages/actions";
import { spacedTaxNumber, type FeeConfig } from "@/lib/fees";
import { withNetworkGuard } from "@/lib/network";
import { Section } from "./profile-form";

const onboard = withNetworkGuard(startStripeOnboarding);

const button =
  "flex h-12 w-full items-center justify-center gap-2 rounded-md border border-line text-[15px] font-medium active:bg-canvas disabled:opacity-50";

export function PaymentsSection({
  accountId,
  enabled,
  failed,
  fee: feeInfo,
}: {
  accountId: string | null;
  enabled: boolean;
  failed: boolean;
  fee: { label: string | null; taxNumbers: FeeConfig["taxNumbers"] }; // ex. "1 % + 0,30 $ (+ TPS et TVQ)"
}) {
  const [state, action, pending] = useActionState<SettingsState>(onboard, { error: null });
  const error = state.error ?? (failed ? "Stripe indisponible. Réessayez dans un instant." : null);
  const fee = feeInfo.label && (
    <p className="text-[13px] text-muted">
      Commission de la plateforme : {feeInfo.label} par paiement en ligne, prélevée automatiquement, en plus des frais Stripe.
      {feeInfo.taxNumbers &&
        ` N° de TPS ${spacedTaxNumber(feeInfo.taxNumbers.tps)} · N° de TVQ ${spacedTaxNumber(feeInfo.taxNumbers.tvq)}.`}
    </p>
  );

  if (enabled) {
    return (
      <Section title="Paiements en ligne">
        <p className="flex items-center gap-2 text-[15px] font-medium text-paid">
          <CircleCheck size={18} strokeWidth={1.75} aria-hidden />
          Activés. Les paiements arrivent sur votre compte Stripe.
        </p>
        {fee}
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
        Compte Stripe à votre nom : identité, coordonnées bancaires. Environ 5 minutes. Vous êtes payé directement.
      </p>
      {fee}
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

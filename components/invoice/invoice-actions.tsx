"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, CreditCard, PenLine, Send, Share } from "lucide-react";
import { generatePaymentLink, sendPaymentLinkSms, type ActionState } from "@/app/(app)/devis/[id]/actions";
import { withNetworkGuard } from "@/lib/network";
import type { DisplayStatus } from "@/lib/types";

const generateLink = withNetworkGuard(generatePaymentLink);
const sendLinkSms = withNetworkGuard(sendPaymentLinkSms);

const primary =
  "flex h-13 w-full items-center justify-center gap-2 rounded-md bg-ink text-[16px] font-medium text-white active:bg-black disabled:opacity-50";
const secondary =
  "flex h-12 w-full items-center justify-center gap-2 rounded-md border border-line text-[15px] font-medium active:bg-canvas disabled:opacity-50";

export function InvoiceActions({ id, status, paymentUrl }: { id: string; status: DisplayStatus; paymentUrl: string | null }) {
  const [linkState, generate, generating] = useActionState<ActionState, FormData>(generateLink, { error: null });
  const [smsState, sendSms, sending] = useActionState<ActionState, FormData>(sendLinkSms, { error: null });
  const [copied, setCopied] = useState(false);

  if (status === "paid") return null;

  const share = async () => {
    if (!paymentUrl) return;
    if (navigator.share) {
      await navigator.share({ url: paymentUrl }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
    }
  };

  const error = linkState.error ?? smsState.error;

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-lg space-y-2">
        {error && <p role="alert" className="text-[14px] text-late">{error}</p>}

        {(status === "draft" || status === "sent") && (
          <Link href={`/devis/${id}/signer`} className={primary}>
            <PenLine size={20} strokeWidth={1.75} aria-hidden />
            Faire signer sur place
          </Link>
        )}

        {(status === "signed" || status === "late") && !paymentUrl && (
          <form action={generate}>
            <input type="hidden" name="id" value={id} />
            <button className={primary} disabled={generating}>
              <CreditCard size={20} strokeWidth={1.75} aria-hidden />
              {generating ? "Création…" : "Générer le lien de paiement"}
            </button>
          </form>
        )}

        {(status === "signed" || status === "late") && paymentUrl && (
          <>
            <button type="button" onClick={share} className={secondary}>
              {copied ? <Check size={18} strokeWidth={1.75} aria-hidden /> : <Share size={18} strokeWidth={1.75} aria-hidden />}
              {copied ? "Lien copié" : "Partager le lien"}
            </button>
            <form action={sendSms}>
              <input type="hidden" name="id" value={id} />
              <button className={primary} disabled={sending || smsState.done}>
                {smsState.done ? <Check size={20} strokeWidth={2} aria-hidden /> : <Send size={20} strokeWidth={1.75} aria-hidden />}
                {smsState.done ? "Lien envoyé par SMS" : sending ? "Envoi…" : "Envoyer le lien par SMS"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

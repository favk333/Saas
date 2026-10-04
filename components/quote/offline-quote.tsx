"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleCheck, WifiOff } from "lucide-react";
import { QuoteSummary } from "@/components/quote/quote-summary";
import { SignaturePad } from "@/components/signature/signature-form";
import { formatCents } from "@/lib/format";
import { addToOutbox } from "@/lib/outbox";
import { computeTotals, type QuoteFields, type QuoteInput } from "@/lib/quote";
import type { InvoiceDetail } from "@/lib/types";

/** Met la soumission (et sa signature) en file d'attente sur le téléphone. */
export async function queueQuote(args: {
  userId: string;
  intent: "sign" | "sms";
  fields: QuoteFields;
  input: QuoteInput;
  signature?: string;
}) {
  const now = new Date().toISOString();
  await addToOutbox({
    id: crypto.randomUUID(), // devient l'identifiant de la soumission : un renvoi ne crée pas de doublon
    userId: args.userId,
    intent: args.intent,
    fields: args.fields,
    totalCents: computeTotals(args.input.items.map((it) => it.cents), args.input.taxRegime).total,
    signature: args.signature,
    signedAt: args.signature ? now : undefined,
    createdAt: now,
  });
}

/** Aperçu local, calculé comme le serveur, pour que le client sache ce qu'il signe. */
function previewOf(input: QuoteInput): InvoiceDetail {
  const t = computeTotals(input.items.map((it) => it.cents), input.taxRegime);
  return {
    client: { name: input.clientName, phone: input.phone },
    site_address: input.siteAddress,
    tax_regime: input.taxRegime,
    subtotal_cents: t.subtotal,
    tps_cents: t.tps,
    tvq_cents: t.tvq,
    tax_cents: t.tax,
    total_cents: t.total,
    line_items: input.items.map((it, position) => ({
      position,
      description: it.description,
      quantity: 1,
      unit_price_cents: it.cents,
      total_cents: it.cents,
    })),
  } as InvoiceDetail;
}

export function OfflineBar({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-3 text-[14px]">
      <WifiOff size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Signature sur place sans réseau : la soumission sera envoyée plus tard, avec sa signature. */
export function OfflineSign({
  userId,
  fields,
  input,
  onBack,
  onQueued,
}: {
  userId: string;
  fields: QuoteFields;
  input: QuoteInput;
  onBack: () => void;
  onQueued: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const preview = previewOf(input);

  const onValidate = async (png: string) => {
    setSaving(true);
    try {
      await queueQuote({ userId, intent: "sign", fields, input, signature: png });
      onQueued();
    } catch {
      setError("Enregistrement sur le téléphone impossible. Vérifiez l'espace de stockage.");
      setSaving(false);
    }
  };

  return (
    <div className="pb-[calc(100px+env(safe-area-inset-bottom))]">
      <OfflineBar>Hors ligne. La soumission recevra son numéro à l&apos;envoi.</OfflineBar>
      <QuoteSummary invoice={preview} />
      <div className="flex items-center justify-between pl-4 pr-1 pb-3">
        <p className="text-[14px] text-muted">
          Acceptation. En signant, le client accepte cette soumission d&apos;un montant total de {formatCents(preview.total_cents)}.
        </p>
        <button type="button" onClick={onBack} className="h-12 shrink-0 rounded-md px-3 text-[14px] font-medium active:bg-canvas">
          Modifier
        </button>
      </div>
      <SignaturePad onValidate={onValidate} pending={saving} error={error} />
    </div>
  );
}

/** Confirmation : rien n'est perdu, l'envoi se fera tout seul. */
export function OfflineQueued({ intent }: { intent: "sign" | "sms" }) {
  return (
    <main className="flex min-h-[70dvh] flex-col justify-end px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
      <p className="flex items-center gap-2 text-[17px] font-semibold text-paid">
        <CircleCheck size={22} strokeWidth={1.75} aria-hidden />
        {intent === "sign" ? "Soumission signée" : "Soumission enregistrée"}
      </p>
      <p className="mt-2 text-[15px] text-muted">
        {intent === "sign"
          ? "Elle est gardée sur ce téléphone et sera envoyée automatiquement dès que le réseau revient."
          : "Le SMS de signature partira automatiquement dès que le réseau revient."}
      </p>
      <Link href="/" className="mt-6 flex h-13 w-full items-center justify-center rounded-md bg-ink text-[16px] font-medium text-white active:bg-black">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}

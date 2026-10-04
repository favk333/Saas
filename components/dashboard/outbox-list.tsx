"use client";

import { CloudUpload, TriangleAlert } from "lucide-react";
import { formatCents } from "@/lib/format";
import { removeFromOutbox, useOutbox, type OutboxItem } from "@/lib/outbox";

/** Soumissions faites hors ligne, pas encore envoyées. Elles n'existent que sur ce téléphone. */
export function OutboxList({ userId }: { userId: string }) {
  const { items } = useOutbox(userId);
  if (items.length === 0) return null;

  return (
    <section className="border-b border-line" aria-label="En attente d'envoi">
      <h2 className="flex items-center gap-2 px-4 pt-4 text-[13px] font-medium tracking-wide text-muted uppercase">
        <CloudUpload size={15} strokeWidth={1.75} aria-hidden />
        En attente d&apos;envoi · {items.length}
      </h2>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function Row({ item }: { item: OutboxItem }) {
  const failed = item.status === "failed";
  const label = item.intent === "sign" ? "Signée sur ce téléphone" : "SMS à envoyer";

  return (
    <li className="px-4 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="truncate text-[16px] font-medium">{item.fields.clientName}</p>
        <p className="shrink-0 text-[16px] font-semibold tabular-nums">{formatCents(item.totalCents)}</p>
      </div>
      {failed ? (
        <>
          <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-late">
            <TriangleAlert size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
            Envoi refusé : {item.error}
          </p>
          <button
            type="button"
            onClick={() => confirm("Supprimer définitivement cette soumission du téléphone ?") && removeFromOutbox(item.id)}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-md border border-line text-[15px] font-medium text-late active:bg-canvas"
          >
            Supprimer
          </button>
        </>
      ) : (
        <p className="mt-1.5 text-[13px] text-muted">
          {label} · envoi automatique au retour du réseau
          {item.lastError ? ` · ${item.lastError}` : ""}
        </p>
      )}
    </li>
  );
}

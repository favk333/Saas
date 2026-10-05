"use client";

import { useActionState, useState } from "react";
import { deleteMyAccount, type SettingsState } from "@/app/(app)/reglages/actions";
import { clearCachedPages } from "@/components/service-worker";
import { withNetworkGuard } from "@/lib/network";
import { removeFromOutbox, useOutbox } from "@/lib/outbox";
import { Section } from "./profile-form";

const WORD = "SUPPRIMER"; // même mot que dans deleteMyAccount
const remove = withNetworkGuard(deleteMyAccount);
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** Suppression définitive du compte, après confirmation tapée. */
export function DeleteAccountSection({ userId, documents, unpaid }: { userId: string; documents: number; unpaid: number }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const { items: offline } = useOutbox(userId);

  const [state, action, pending] = useActionState<SettingsState, FormData>(async (prev, formData) => {
    const result = await remove(prev, formData);
    if (result.done) {
      // Rien ne doit rester sur le téléphone : pages en cache et soumissions hors ligne de ce compte.
      await Promise.all(offline.map((i) => removeFromOutbox(i.id).catch(() => {})));
      await clearCachedPages();
      window.location.replace("/login?compte=supprime");
    }
    return result;
  }, { error: null });

  if (!open) {
    return (
      <Section title="Supprimer le compte">
        <button type="button" onClick={() => setOpen(true)}
          className="flex h-12 w-full items-center justify-center rounded-md border border-line text-[15px] font-medium text-late active:bg-canvas">
          Supprimer mon compte
        </button>
      </Section>
    );
  }

  return (
    <Section title="Supprimer le compte">
      <div className="space-y-2 text-[14px]">
        <p className="font-medium">Cette action est définitive. Seront effacés :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>votre profil d&apos;entreprise et vos clients ;</li>
          <li>
            vos soumissions et factures{documents ? ` (${documents})` : ""}, avec les signatures
            {unpaid ? <strong className="text-late"> (dont {plural(unpaid, "facture")} non payée{unpaid > 1 ? "s" : ""} : les liens de paiement seront désactivés)</strong> : null} ;
          </li>
          {offline.length ? (
            <li className="text-late">
              {plural(offline.length, "soumission")} hors ligne pas encore envoyée{offline.length > 1 ? "s" : ""} ;
            </li>
          ) : null}
          <li>vos accès : e-mail et mot de passe.</li>
        </ul>
        <p className="text-muted">
          Téléchargez avant les PDF de vos factures et vos relevés : vous devez conserver vos pièces 6 ans (Revenu Québec, ARC).
          Votre compte Stripe reste à vous, avec vos virements ; il se ferme depuis votre tableau de bord Stripe.
        </p>
      </div>

      <form action={action} className="space-y-3">
        <label className="block text-[14px]">
          Tapez <strong>{WORD}</strong> pour confirmer
          <input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters"
            spellCheck={false} className="mt-1 h-12 w-full rounded-md border border-line bg-white px-3 text-[16px] outline-none focus:border-ink" />
        </label>
        {state.error && <p role="alert" className="text-[14px] text-late">{state.error}</p>}
        <button disabled={pending || typed.trim().toUpperCase() !== WORD}
          className="flex h-12 w-full items-center justify-center rounded-md bg-late text-[15px] font-medium text-white disabled:opacity-40">
          {pending ? "Suppression…" : "Supprimer définitivement"}
        </button>
        <button type="button" disabled={pending} onClick={() => { setOpen(false); setTyped(""); }}
          className="flex h-12 w-full items-center justify-center rounded-md border border-line text-[15px] font-medium active:bg-canvas">
          Annuler
        </button>
      </form>
    </Section>
  );
}

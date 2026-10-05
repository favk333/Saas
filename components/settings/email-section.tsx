"use client";

import { useActionState } from "react";
import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { changeEmail, type EmailState } from "@/app/(app)/reglages/actions";
import { withNetworkGuard } from "@/lib/network";
import { Section } from "./profile-form";

const send = withNetworkGuard(changeEmail);
const input = "h-12 w-full rounded-md border border-line bg-white px-3 text-[16px] outline-none focus:border-ink";

export type EmailReturn = "ok" | "attente" | "erreur" | null; // retour de /auth/email

const RETURNS = {
  ok: { icon: CircleCheck, tone: "text-paid", text: "Adresse e-mail changée. Utilisez-la pour vous connecter." },
  attente: { icon: Clock, tone: "text-ink", text: "Confirmation reçue. Si un second e-mail de confirmation a été envoyé à votre autre adresse, ouvrez-le aussi pour terminer." },
  erreur: { icon: TriangleAlert, tone: "text-late", text: "Lien de confirmation expiré ou invalide. Recommencez le changement." },
};

/** Changement d'adresse e-mail du compte (confirmation par e-mail, voir /auth/email). */
export function EmailSection({ email, pendingEmail, returned }: { email: string | null; pendingEmail: string | null; returned: EmailReturn }) {
  const [state, action, pending] = useActionState<EmailState, FormData>(send, { error: null });
  const waitingFor = state.pendingEmail ?? pendingEmail;
  const notice = returned ? RETURNS[returned] : null;

  return (
    <Section title="Adresse e-mail">
      {notice && (
        <p role="status" className={`flex items-start gap-2 text-[14px] ${notice.tone}`}>
          <notice.icon size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
          {notice.text}
        </p>
      )}
      {email && (
        <p className="text-[15px]">
          <span className="block text-[13px] text-muted">Adresse actuelle</span>
          <span className="break-all">{email}</span>
        </p>
      )}

      {waitingFor && returned !== "ok" ? (
        <p className="rounded-md border border-line p-3 text-[14px]">
          Changement en attente vers <strong className="break-all">{waitingFor}</strong>.{" "}
          <span className="text-muted">
            Ouvrez le lien de confirmation reçu par e-mail (à chaque adresse si deux e-mails ont été envoyés), de préférence sur ce téléphone.
          </span>
        </p>
      ) : null}

      <form action={action} className="space-y-3">
        <input name="email" type="email" inputMode="email" autoComplete="email" required aria-label="Nouvelle adresse e-mail"
          placeholder="Nouvelle adresse e-mail" className={input} />
        {state.error && <p role="alert" className="text-[14px] text-late">{state.error}</p>}
        <button disabled={pending}
          className="flex h-12 w-full items-center justify-center rounded-md border border-line text-[15px] font-medium active:bg-canvas disabled:opacity-60">
          {pending ? "Envoi…" : waitingFor ? "Renvoyer / changer la nouvelle adresse" : "Changer d'adresse"}
        </button>
      </form>
    </Section>
  );
}

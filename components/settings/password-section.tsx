"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { setPassword, type SettingsState } from "@/app/(app)/reglages/actions";
import { withNetworkGuard } from "@/lib/network";
import { Section } from "./profile-form";

const save = withNetworkGuard(setPassword);
const input = "h-12 w-full rounded-md border border-line bg-white px-3 text-[16px] outline-none focus:border-ink";

/** Mot de passe pour se connecter sans attendre un lien par e-mail. */
export function PasswordSection() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(save, { error: null });

  return (
    <Section title="Mot de passe">
      <p className="text-[13px] text-muted">Pour vous connecter sans attendre un lien par e-mail. 8 caractères minimum.</p>
      <form action={action} className="space-y-3">
        <input name="password" type="password" autoComplete="new-password" aria-label="Nouveau mot de passe"
          placeholder="Nouveau mot de passe" required minLength={8} className={input} />
        <input name="confirm" type="password" autoComplete="new-password" aria-label="Confirmer le mot de passe"
          placeholder="Confirmer" required minLength={8} className={input} />
        {state.error && <p role="alert" className="text-[14px] text-late">{state.error}</p>}
        <button disabled={pending || state.done}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-md border text-[15px] font-medium active:bg-canvas disabled:opacity-60 ${
            state.done ? "border-paid text-paid" : "border-line"
          }`}>
          {state.done && <Check size={18} strokeWidth={2} aria-hidden />}
          {state.done ? "Mot de passe enregistré" : pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </button>
      </form>
    </Section>
  );
}

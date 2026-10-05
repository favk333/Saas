"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { withNetworkGuard } from "@/lib/network";
import { resetPassword, type ResetState } from "./actions";

const save = withNetworkGuard(resetPassword);
const input = "mt-1 h-12 w-full rounded-md border border-line px-3 text-[16px] outline-none focus:border-ink";

export function ResetForm({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(save, { error: null });
  const [shown, setShown] = useState(false);
  const type = shown ? "text" : "password";

  return (
    <form action={action} className="mt-6">
      {/* Aide les gestionnaires de mots de passe à associer le nouveau mot de passe au bon compte. */}
      {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}

      <label htmlFor="password" className="text-[13px] text-muted">Nouveau mot de passe</label>
      <div className="relative">
        <input id="password" name="password" type={type} autoComplete="new-password" required minLength={8} className={`${input} pr-12`} />
        <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute top-1 right-0 flex h-12 w-12 items-center justify-center text-muted">
          {shown ? <EyeOff size={18} strokeWidth={1.75} aria-hidden /> : <Eye size={18} strokeWidth={1.75} aria-hidden />}
        </button>
      </div>

      <label htmlFor="confirm" className="mt-4 block text-[13px] text-muted">Confirmer</label>
      <input id="confirm" name="confirm" type={type} autoComplete="new-password" required minLength={8} className={input} />

      <p className="mt-2 text-[13px] text-muted">8 caractères minimum.</p>
      {state.error && <p role="alert" className="mt-3 text-[14px] text-late">{state.error}</p>}

      <button disabled={pending}
        className="mt-4 h-13 w-full rounded-md bg-ink text-[16px] font-medium text-white active:bg-black disabled:opacity-50">
        {pending ? "Enregistrement…" : "Enregistrer et me connecter"}
      </button>
    </form>
  );
}

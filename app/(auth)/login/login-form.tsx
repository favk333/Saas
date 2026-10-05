"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Mail } from "lucide-react";
import { withNetworkGuard } from "@/lib/network";
import { sendMagicLink, signInWithPassword, type LoginState } from "./actions";

const passwordLogin = withNetworkGuard(signInWithPassword);
const magicLink = withNetworkGuard(sendMagicLink);

const input = "mt-1 h-12 w-full rounded-md border border-line px-3 text-[16px] outline-none focus:border-ink";

export function LoginForm({ callbackError }: { callbackError: boolean }) {
  const [login, loginAction, loggingIn] = useActionState<LoginState, FormData>(passwordLogin, { error: null });
  const [link, linkAction, sending] = useActionState<LoginState, FormData>(magicLink, { error: null });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);

  if (link.sent) {
    return (
      <p className="mt-2 text-[15px] text-muted">
        Lien envoyé à {email}. Ouvrez l&apos;e-mail sur ce téléphone.
      </p>
    );
  }

  const error =
    login.error ?? link.error ?? (callbackError ? "Lien de connexion expiré ou invalide. Connectez-vous à nouveau." : null);

  return (
    <form action={loginAction} className="mt-6">
      <label htmlFor="email" className="text-[13px] text-muted">E-mail</label>
      <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required
        value={email} onChange={(e) => setEmail(e.target.value)} className={input} />

      <label htmlFor="password" className="mt-4 block text-[13px] text-muted">Mot de passe</label>
      <div className="relative">
        <input id="password" name="password" type={shown ? "text" : "password"} autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} pr-12`} />
        <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute top-1 right-0 flex h-12 w-12 items-center justify-center text-muted">
          {shown ? <EyeOff size={18} strokeWidth={1.75} aria-hidden /> : <Eye size={18} strokeWidth={1.75} aria-hidden />}
        </button>
      </div>

      {error && <p role="alert" className="mt-3 text-[14px] text-late">{error}</p>}

      <button disabled={loggingIn || sending}
        className="mt-4 h-13 w-full rounded-md bg-ink text-[16px] font-medium text-white active:bg-black disabled:opacity-50">
        {loggingIn ? "Connexion…" : "Se connecter"}
      </button>

      {/* Comptes sans mot de passe (créés par lien) et première connexion. */}
      <button type="submit" formAction={linkAction} formNoValidate disabled={loggingIn || sending}
        className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-md border border-line text-[15px] font-medium active:bg-canvas disabled:opacity-50">
        <Mail size={18} strokeWidth={1.75} aria-hidden />
        {sending ? "Envoi…" : "Recevoir un lien par e-mail"}
      </button>
    </form>
  );
}

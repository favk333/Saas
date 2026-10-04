"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { CloudUpload, TriangleAlert } from "lucide-react";
import { signRemote } from "@/app/s/[token]/actions";
import { SignaturePad, type SignatureState } from "@/components/signature/signature-form";
import { NETWORK_ERROR, withNetworkGuard } from "@/lib/network";
import { addToOutbox, getRemotePending, type RemoteSignItem } from "@/lib/outbox";

const guardedSignRemote = withNetworkGuard(signRemote);

/**
 * Signature du client sur le lien reçu par SMS.
 * Sans réseau, la signature est gardée sur son téléphone et envoyée au retour du réseau
 * (service worker, POST /api/remote-sign).
 */
export function RemoteSignature({ token }: { token: string }) {
  const [state, dispatch, sending] = useActionState<SignatureState, FormData>(guardedSignRemote, { error: null });
  const [pending, setPending] = useState<RemoteSignItem | null>(null);
  const [checked, setChecked] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastPng = useRef<string | null>(null);

  // Signature déjà en attente sur ce téléphone (lien rouvert plus tard).
  useEffect(() => {
    const check = () => getRemotePending(token).then((item) => {
      setPending(item);
      setChecked(true);
    });
    check();
    const onMessage = (e: MessageEvent) => e.data?.type === "outbox-changed" && check();
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [token]);

  const queue = async (png: string) => {
    const now = new Date().toISOString();
    const item: RemoteSignItem = { kind: "remote", id: `remote:${token}`, token, signature: png, signedAt: now, createdAt: now };
    try {
      await addToOutbox(item);
      setPending(item);
    } catch {
      setSaveError("Enregistrement sur votre téléphone impossible. Réessayez quand vous aurez du réseau.");
    }
  };

  // Réseau annoncé mais l'envoi échoue (réseau très faible) : même bascule.
  useEffect(() => {
    if (state.error === NETWORK_ERROR && lastPng.current) void queue(lastPng.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onValidate = (png: string) => {
    lastPng.current = png;
    setSaveError(null);
    if (!navigator.onLine) return void queue(png);
    const fd = new FormData();
    fd.set("token", token);
    fd.set("signature", png);
    startTransition(() => dispatch(fd));
  };

  if (!checked) return null;

  if (pending) {
    const failed = pending.status === "failed";
    return (
      <div className="mx-4 rounded-md border border-line p-4">
        {failed ? (
          <p className="flex items-start gap-2 text-[15px] text-late">
            <TriangleAlert size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
            Envoi refusé : {pending.error}
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-[15px] font-medium">
              <CloudUpload size={18} strokeWidth={1.75} aria-hidden />
              Signature enregistrée sur votre téléphone
            </p>
            <p className="mt-2 text-[14px] text-muted">
              Elle sera envoyée dès que le réseau revient. Si vous fermez cette page, rouvrez le lien reçu par SMS
              quand vous aurez du réseau.
            </p>
          </>
        )}
      </div>
    );
  }

  const error = saveError ?? (state.error === NETWORK_ERROR ? null : state.error);
  return <SignaturePad onValidate={onValidate} pending={sending} error={error} />;
}

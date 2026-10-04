"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";

// Dernier filet : page impossible à charger (réseau coupé, serveur indisponible).
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-end px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
      <h1 className="text-[22px] font-semibold tracking-tight">{offline ? "Pas de réseau" : "Chargement impossible"}</h1>
      <p className="mt-2 text-[15px] text-muted">
        {offline ? "Réessayez dès que ça capte. Votre saisie en cours est conservée." : "Réessayez dans un instant."}
      </p>
      <button
        onClick={() => startTransition(() => { router.refresh(); reset(); })}
        className="mt-6 h-13 w-full rounded-md bg-ink text-[16px] font-medium text-white active:bg-black"
      >
        Réessayer
      </button>
    </main>
  );
}

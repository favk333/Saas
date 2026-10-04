"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/(app)/reglages/actions";
import { clearCachedPages } from "@/components/service-worker";
import { listOutbox } from "@/lib/outbox";

export function LogoutButton({ userId }: { userId: string }) {
  const onSubmit = async () => {
    // Les soumissions hors ligne restent sur le téléphone, rattachées à ce compte :
    // elles partiront à la prochaine connexion.
    const pending = (await listOutbox(userId)).length;
    if (
      pending > 0 &&
      !confirm(`${pending} soumission${pending > 1 ? "s" : ""} pas encore envoyée${pending > 1 ? "s" : ""}. Elle${pending > 1 ? "s" : ""} partira à votre prochaine connexion. Se déconnecter ?`)
    ) {
      return;
    }
    await clearCachedPages();
    await signOut();
  };

  return (
    <form action={onSubmit}>
      <button className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-line text-[15px] font-medium text-late active:bg-canvas">
        <LogOut size={18} strokeWidth={1.75} aria-hidden />
        Se déconnecter
      </button>
    </form>
  );
}

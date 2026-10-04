"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/(app)/reglages/actions";
import { clearCachedPages } from "@/components/service-worker";

export function LogoutButton() {
  return (
    <form action={async () => { await clearCachedPages(); await signOut(); }}>
      <button className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-line text-[15px] font-medium text-late active:bg-canvas">
        <LogOut size={18} strokeWidth={1.75} aria-hidden />
        Se déconnecter
      </button>
    </form>
  );
}

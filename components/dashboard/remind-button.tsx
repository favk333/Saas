"use client";

import { useActionState } from "react";
import { Check, MessageSquare } from "lucide-react";
import { remindBySms, type RemindState } from "@/app/(app)/actions";
import { withNetworkGuard } from "@/lib/network";

const remind = withNetworkGuard(remindBySms);

export function RemindButton({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState<RemindState, FormData>(remind, { error: null });

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <button
        type="submit"
        disabled={pending || state.done}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-md border text-[15px] font-medium active:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
          state.done ? "border-paid text-paid" : "border-line"
        }`}
      >
        {state.done ? <Check size={18} strokeWidth={2} aria-hidden /> : <MessageSquare size={18} strokeWidth={1.75} aria-hidden />}
        {state.done ? "Relance envoyée" : pending ? "Envoi…" : "Relancer par SMS"}
      </button>
      {state.error && <p role="alert" className="mt-1.5 text-[13px] text-late">{state.error}</p>}
    </form>
  );
}

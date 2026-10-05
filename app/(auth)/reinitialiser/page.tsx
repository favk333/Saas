import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient, getUser } from "@/lib/supabase/server";
import { ResetForm } from "./reset-form";

// Atteinte via /auth/reset (lien « mot de passe oublié »), qui ouvre la session de récupération.
export default async function ResetPasswordPage() {
  const user = isSupabaseConfigured ? await getUser(await createClient()) : null;
  if (isSupabaseConfigured && !user) redirect("/login?error=reset");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-end px-4 pt-[env(safe-area-inset-top)] pb-[max(16px,env(safe-area-inset-bottom))]">
      <h1 className="text-[22px] font-semibold tracking-tight">Nouveau mot de passe</h1>
      {user?.email && <p className="mt-1 text-[15px] text-muted">{user.email}</p>}
      <ResetForm email={user?.email ?? null} />
    </main>
  );
}

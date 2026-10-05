import { supabaseConfigIssues } from "@/lib/supabase/config";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; compte?: string }> }) {
  const { error, compte } = await searchParams;
  const configIssues = supabaseConfigIssues(); // vide si tout va bien ; les valeurs ne sont jamais affichées // retour de lien invalide : ?error=1 (auth/callback), ?error=reset (auth/reset), ?error=email (auth/email)

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-end px-4 pt-[env(safe-area-inset-top)] pb-[max(16px,env(safe-area-inset-bottom))]">
      {configIssues.length > 0 && (
        <div role="alert" className="mb-6 rounded-md border border-late p-3 text-[14px] text-late">
          <p className="font-medium">Configuration Supabase incorrecte (variables d&apos;environnement Vercel) :</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {configIssues.map((i) => <li key={i}>{i}</li>)}
          </ul>
          <p className="mt-1">Corriger dans Vercel → Settings → Environment Variables, puis redéployer.</p>
        </div>
      )}
      {compte === "supprime" && (
        <p role="status" className="mb-6 rounded-md border border-line p-3 text-[15px]">
          Votre compte a été supprimé, avec vos soumissions, factures et clients.
        </p>
      )}
      <h1 className="text-[22px] font-semibold tracking-tight">Connexion</h1>
      <LoginForm callbackError={error === "reset" || error === "email" ? error : error ? "link" : null} />
    </main>
  );
}

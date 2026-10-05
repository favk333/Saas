import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; compte?: string }> }) {
  const { error, compte } = await searchParams; // retour de lien invalide : ?error=1 (auth/callback), ?error=reset (auth/reset), ?error=email (auth/email)

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-end px-4 pt-[env(safe-area-inset-top)] pb-[max(16px,env(safe-area-inset-bottom))]">
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

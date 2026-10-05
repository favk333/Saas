import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams; // retour de lien invalide : ?error=1 (auth/callback), ?error=reset (auth/reset)

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-end px-4 pt-[env(safe-area-inset-top)] pb-[max(16px,env(safe-area-inset-bottom))]">
      <h1 className="text-[22px] font-semibold tracking-tight">Connexion</h1>
      <LoginForm callbackError={error === "reset" ? "reset" : error ? "link" : null} />
    </main>
  );
}

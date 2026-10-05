import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams; // ?error=1 : retour de lien magique invalide (auth/callback)

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-end px-4 pt-[env(safe-area-inset-top)] pb-[max(16px,env(safe-area-inset-bottom))]">
      <h1 className="text-[22px] font-semibold tracking-tight">Connexion</h1>
      <LoginForm callbackError={Boolean(error)} />
    </main>
  );
}

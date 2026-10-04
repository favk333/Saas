import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) redirect("/login?error=1");

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  redirect(error ? "/login?error=1" : "/login?sent=1");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-end px-4 pt-[env(safe-area-inset-top)] pb-[max(16px,env(safe-area-inset-bottom))]">
      <h1 className="text-[22px] font-semibold tracking-tight">Connexion</h1>
      {sent ? (
        <p className="mt-2 text-[15px] text-muted">Lien envoyé. Ouvrez l&apos;e-mail sur ce téléphone.</p>
      ) : (
        <form action={sendMagicLink} className="mt-6">
          <label htmlFor="email" className="text-[13px] text-muted">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            className="mt-1 h-12 w-full rounded-md border border-line px-3 text-[16px] outline-none focus:border-ink"
          />
          {error && <p className="mt-2 text-[14px] text-late">Échec de l&apos;envoi. Vérifiez l&apos;adresse.</p>}
          <button className="mt-4 h-13 w-full rounded-md bg-ink text-[16px] font-medium text-white active:bg-black">
            Recevoir le lien de connexion
          </button>
        </form>
      )}
    </main>
  );
}

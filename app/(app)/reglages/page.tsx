import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { PaymentsSection } from "@/components/settings/payments-section";
import { ProfileForm, Section } from "@/components/settings/profile-form";
import { getProfile } from "@/lib/data";
import { signOut } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ bienvenue?: string; stripe?: string }> }) {
  const { bienvenue, stripe } = await searchParams;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const welcome = Boolean(bienvenue) || !profile.company_name;

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-white pb-[calc(96px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-line bg-white px-1 pt-[env(safe-area-inset-top)]">
        {welcome ? (
          <h1 className="px-3 text-[17px] font-semibold">Bienvenue</h1>
        ) : (
          <>
            <Link href="/" aria-label="Retour" className="flex h-12 w-12 items-center justify-center rounded-md active:bg-canvas">
              <ChevronLeft size={24} strokeWidth={1.75} aria-hidden />
            </Link>
            <h1 className="text-[17px] font-semibold">Réglages</h1>
          </>
        )}
      </header>

      {welcome && (
        <p className="border-b border-line px-4 py-4 text-[15px] text-muted">
          Renseignez votre entreprise. Elle apparaît sur vos devis et dans les SMS envoyés à vos clients.
        </p>
      )}

      <ProfileForm profile={profile} welcome={welcome} />

      {!welcome && (
        <>
          <PaymentsSection accountId={profile.stripe_account_id} enabled={profile.stripe_charges_enabled} failed={stripe === "erreur"} />
          <Section title="Compte">
            {profile.email && <p className="text-[15px]">{profile.email}</p>}
            <form action={signOut}>
              <button className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-line text-[15px] font-medium text-late active:bg-canvas">
                <LogOut size={18} strokeWidth={1.75} aria-hidden />
                Se déconnecter
              </button>
            </form>
          </Section>
        </>
      )}
    </div>
  );
}

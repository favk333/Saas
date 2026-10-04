"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { saveProfile, type SettingsState } from "@/app/(app)/reglages/actions";
import { TaxRegimePicker } from "@/components/ui/tax-regime-picker";
import { formatRbq } from "@/lib/identifiers";
import type { Profile } from "@/lib/data";
import { withNetworkGuard } from "@/lib/network";

const save = withNetworkGuard(saveProfile);

const input =
  "h-12 w-full rounded-md border border-line bg-white px-3 text-[16px] outline-none placeholder:text-muted/60 focus:border-ink";
const label = "mb-1 block text-[13px] text-muted";

/** "+15145551234" → "514 555-1234", "+33611223344" → "06 11 22 33 44" pour l'affichage. */
function displayPhone(e164: string | null) {
  if (!e164) return "";
  if (/^\+1\d{10}$/.test(e164)) return e164.slice(2).replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2-$3");
  if (e164.startsWith("+33")) return ("0" + e164.slice(3)).replace(/(\d{2})(?=\d)/g, "$1 ");
  return e164;
}
/** "123456789RT0001" → "123456789 RT0001" */
const spaced = (n: string | null) => (n ?? "").replace(/^(\d+)([A-Z]{2}\d{4})$/, "$1 $2");

export function ProfileForm({ profile, welcome }: { profile: Profile; welcome: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(save, { error: null });
  const [values, setValues] = useState({
    companyName: profile.company_name,
    phone: displayPhone(profile.phone),
    neq: profile.neq ?? "",
    rbqLicence: profile.rbq_licence ? formatRbq(profile.rbq_licence) : "",
    address: profile.address ?? "",
    tpsNumber: spaced(profile.tps_number),
    tvqNumber: spaced(profile.tvq_number),
    insurance: profile.insurance ?? "",
  });
  const [taxRegime, setTaxRegime] = useState(profile.default_tax_regime);
  const [dirty, setDirty] = useState(false);

  const field = (key: keyof typeof values) => ({
    id: key,
    name: key,
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues({ ...values, [key]: e.target.value });
      setDirty(true);
    },
  });

  const saved = state.done && !dirty;

  return (
    <form action={(fd) => { setDirty(false); return action(fd); }}>
      {welcome && <input type="hidden" name="welcome" value="1" />}

      <Section title="Entreprise">
        <div>
          <label htmlFor="companyName" className={label}>Nom affiché sur les soumissions, factures et SMS</label>
          <input {...field("companyName")} className={input} autoComplete="organization" required />
        </div>
        <div>
          <label htmlFor="phone" className={label}>Téléphone</label>
          <input {...field("phone")} type="tel" inputMode="tel" className={input} autoComplete="tel" />
        </div>
        <div>
          <label htmlFor="neq" className={label}>NEQ</label>
          <input {...field("neq")} inputMode="numeric" className={`${input} tabular-nums`} autoComplete="off" placeholder="1234567890" />
        </div>
        <div>
          <label htmlFor="address" className={label}>Adresse</label>
          <input {...field("address")} className={input} autoComplete="street-address" />
        </div>
      </Section>

      <Section title="Mentions légales">
        <div>
          <label htmlFor="tpsNumber" className={label}>N° de TPS</label>
          <input {...field("tpsNumber")} className={`${input} uppercase tabular-nums`} autoComplete="off" placeholder="123456789 RT0001" />
        </div>
        <div>
          <label htmlFor="tvqNumber" className={label}>N° de TVQ</label>
          <input {...field("tvqNumber")} className={`${input} uppercase tabular-nums`} autoComplete="off" placeholder="1234567890 TQ0001" />
        </div>
        <div>
          <label htmlFor="rbqLicence" className={label}>Licence RBQ</label>
          <input {...field("rbqLicence")} inputMode="numeric" className={`${input} tabular-nums`} autoComplete="off" placeholder="1234-5678-90" />
        </div>
        <div>
          <label htmlFor="insurance" className={label}>Assurance</label>
          <input {...field("insurance")} className={input} autoComplete="off" placeholder="Assureur, n° de police" />
        </div>
      </Section>

      <Section title="Taxes par défaut">
        <TaxRegimePicker name="taxRegime" value={taxRegime} onChange={(v) => { setTaxRegime(v); setDirty(true); }} />
        <p className="text-[13px] text-muted">« Sans taxes » : petit fournisseur non inscrit (moins de 30 000 $ de revenus taxables sur 4 trimestres).</p>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg space-y-2">
          {state.error && <p role="alert" className="text-[14px] text-late">{state.error}</p>}
          <button disabled={pending || saved}
            className={`flex h-13 w-full items-center justify-center gap-2 rounded-md text-[16px] font-medium ${
              saved ? "border border-paid text-paid" : "bg-ink text-white active:bg-black disabled:opacity-50"
            }`}>
            {saved && <Check size={20} strokeWidth={2} aria-hidden />}
            {saved ? "Enregistré" : pending ? "Enregistrement…" : welcome ? "Continuer" : "Enregistrer"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line px-4 py-5">
      <h2 className="text-[13px] font-medium tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PenLine, Plus, Send, X } from "lucide-react";
import { createQuote, type QuoteFormState } from "@/app/(app)/devis/nouveau/actions";
import { formatCents } from "@/lib/format";
import { withNetworkGuard } from "@/lib/network";
import { computeTotals, parseEuros } from "@/lib/quote";
import { TaxRatePicker } from "@/components/ui/tax-rate-picker";

type Line = { key: number; description: string; price: string };

const input =
  "h-12 w-full rounded-md border border-line bg-white px-3 text-[16px] outline-none placeholder:text-muted/60 focus:border-ink";
const label = "mb-1 block text-[13px] text-muted";

let nextKey = 1;
const emptyLine = (): Line => ({ key: nextKey++, description: "", price: "" });

// Brouillon conservé sur le téléphone : une coupure réseau ou une app fermée ne fait rien perdre.
const DRAFT_KEY = "chantier:quote-draft";
type Draft = { client: { name: string; phone: string; address: string }; lines: Omit<Line, "key">[]; taxBps: number };

const readDraft = (): Draft | null => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
  } catch {
    return null;
  }
};
const writeDraft = (d: Draft | null) => {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {}
};
const isRedirect = (e: unknown) => String((e as { digest?: unknown })?.digest ?? "").startsWith("NEXT_REDIRECT");

const guardedCreateQuote = withNetworkGuard(createQuote);
async function submitQuote(prev: QuoteFormState, fd: FormData): Promise<QuoteFormState> {
  try {
    const res = await guardedCreateQuote(prev, fd);
    if (!res.error) writeDraft(null);
    return res;
  } catch (e) {
    if (isRedirect(e)) writeDraft(null); // succès : le serveur redirige vers la signature ou l'accueil
    throw e;
  }
}

export function QuoteForm({ defaultTaxBps }: { defaultTaxBps: number }) {
  const [state, formAction, pending] = useActionState<QuoteFormState, FormData>(submitQuote, { error: null });
  const [client, setClient] = useState({ name: "", phone: "", address: "" });
  const [lines, setLines] = useState<Line[]>(() => [emptyLine()]);
  const [taxBps, setTaxBps] = useState(defaultTaxBps);
  const [restored, setRestored] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    const d = readDraft();
    if (d) {
      setClient(d.client);
      setLines(d.lines.length ? d.lines.map((l) => ({ ...l, key: nextKey++ })) : [emptyLine()]);
      setTaxBps(d.taxBps);
      setRestored(true);
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const empty = !client.name && !client.phone && !client.address && lines.every((l) => !l.description && !l.price);
    writeDraft(empty ? null : { client, lines: lines.map(({ description, price }) => ({ description, price })), taxBps });
  }, [client, lines, taxBps]);

  const discardDraft = () => {
    writeDraft(null);
    setClient({ name: "", phone: "", address: "" });
    setLines([emptyLine()]);
    setTaxBps(defaultTaxBps);
    setRestored(false);
  };

  const totals = computeTotals(lines.map((l) => parseEuros(l.price) ?? 0), taxBps);
  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form action={formAction} className="pb-[calc(160px+env(safe-area-inset-bottom))]">
      {restored && (
        <div className="flex items-center justify-between border-b border-line pl-4 pr-1 text-[14px] text-muted">
          <span>Brouillon restauré</span>
          <button type="button" onClick={discardDraft} className="h-12 rounded-md px-3 font-medium text-ink active:bg-canvas">
            Tout effacer
          </button>
        </div>
      )}
      <Section title="Client">
        <div>
          <label htmlFor="clientName" className={label}>Nom</label>
          <input id="clientName" name="clientName" className={input} autoComplete="off" required
            value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="phone" className={label}>Téléphone (SMS)</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" className={input} autoComplete="off" required
            placeholder="06 12 34 56 78"
            value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
        </div>
        <div>
          <label htmlFor="siteAddress" className={label}>Adresse du chantier</label>
          <input id="siteAddress" name="siteAddress" className={input} autoComplete="street-address"
            value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} />
        </div>
      </Section>

      <Section title="Travaux">
        <ul className="space-y-2">
          {lines.map((line, i) => (
            <li key={line.key} className="flex gap-2">
              <input name="description" aria-label={`Description ligne ${i + 1}`} placeholder="Description"
                className={`${input} min-w-0 flex-1`} autoComplete="off"
                value={line.description} onChange={(e) => updateLine(line.key, { description: e.target.value })} />
              <div className="relative w-28 shrink-0">
                <input name="price" aria-label={`Prix HT ligne ${i + 1}`} inputMode="decimal" placeholder="0"
                  aria-invalid={line.price.trim() !== "" && parseEuros(line.price) === null}
                  className={`${input} pr-7 text-right tabular-nums aria-invalid:border-late aria-invalid:text-late`} autoComplete="off"
                  value={line.price} onChange={(e) => updateLine(line.key, { price: e.target.value })} />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[15px] text-muted">€</span>
              </div>
              {lines.length > 1 && (
                <button type="button" aria-label={`Supprimer la ligne ${i + 1}`}
                  onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-line text-muted active:bg-canvas">
                  <X size={18} strokeWidth={1.75} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setLines((ls) => [...ls, emptyLine()])}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-line text-[15px] font-medium active:bg-canvas">
          <Plus size={18} strokeWidth={1.75} aria-hidden />
          Ajouter une ligne
        </button>
        <p className="text-[13px] text-muted">Prix hors taxes.</p>
      </Section>

      <Section title="TVA">
        <TaxRatePicker name="taxBps" value={taxBps} onChange={setTaxBps} />
      </Section>

      <dl className="space-y-1.5 px-4 py-5 text-[15px] tabular-nums">
        <div className="flex justify-between text-muted"><dt>Sous-total HT</dt><dd>{formatCents(totals.subtotal)}</dd></div>
        <div className="flex justify-between text-muted"><dt>TVA</dt><dd>{formatCents(totals.tax)}</dd></div>
        <div className="flex justify-between pt-1.5 text-[18px] font-semibold"><dt>Total TTC</dt><dd>{formatCents(totals.total)}</dd></div>
      </dl>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg space-y-2">
          {state.error && <p role="alert" className="text-[14px] text-late">{state.error}</p>}
          <button type="submit" name="intent" value="sms" disabled={pending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-line text-[15px] font-medium active:bg-canvas disabled:opacity-50">
            <Send size={18} strokeWidth={1.75} aria-hidden />
            Envoyer par SMS pour signature
          </button>
          <button type="submit" name="intent" value="sign" disabled={pending}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-md bg-ink text-[16px] font-medium text-white active:bg-black disabled:opacity-50">
            <PenLine size={20} strokeWidth={1.75} aria-hidden />
            {pending ? "Enregistrement…" : "Faire signer sur place"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line px-4 py-5">
      <h2 className="text-[13px] font-medium tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

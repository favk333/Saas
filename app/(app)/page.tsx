import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus, Settings } from "lucide-react";
import { InvoiceRow } from "@/components/dashboard/invoice-row";
import { OutboxList } from "@/components/dashboard/outbox-list";
import { getCurrentUserId, getDashboard } from "@/lib/data";
import { formatCents } from "@/lib/format";

type Tab = "pending" | "paid";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = tabParam === "paid" ? "paid" : "pending";
  const [{ companyName, paymentsEnabled, pending, paid }, userId] = await Promise.all([getDashboard(), getCurrentUserId()]);
  if (!companyName) redirect("/reglages?bienvenue=1");
  const list = tab === "paid" ? paid : pending;
  const now = new Date();

  const outstanding = pending.filter((i) => i.status === "signed").reduce((sum, i) => sum + i.total_cents, 0);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-line bg-white pt-[env(safe-area-inset-top)]">
        <div className="pl-4 pr-1 pt-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[15px] font-semibold">{companyName}</p>
            <Link href="/reglages" aria-label="Réglages" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-muted active:bg-canvas">
              <Settings size={20} strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
          <p className="text-[13px] text-muted">À encaisser</p>
          <p className="text-[28px] leading-9 font-semibold tracking-tight tabular-nums">{formatCents(outstanding)}</p>
        </div>

        {!paymentsEnabled && (
          <Link href="/reglages" className="mx-4 mt-3 flex h-12 items-center justify-between rounded-md border border-line px-3 text-[14px] active:bg-canvas">
            <span>Paiements en ligne non activés</span>
            <span className="flex items-center gap-1 font-medium">
              Activer <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
            </span>
          </Link>
        )}

        <nav className="mt-2 grid grid-cols-2 px-4" aria-label="Filtrer">
          <TabLink href="/" active={tab === "pending"} label="En attente de paiement" count={pending.length} />
          <TabLink href="/?tab=paid" active={tab === "paid"} label="Payées" count={paid.length} />
        </nav>
      </header>

      <main className="flex-1 pb-[calc(76px+env(safe-area-inset-bottom))]">
        {userId && tab === "pending" && <OutboxList userId={userId} />}
        {list.length === 0 ? (
          <p className="px-4 py-12 text-center text-[15px] text-muted">
            {tab === "paid" ? "Aucun paiement reçu." : "Rien en attente de paiement."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} now={now} />
            ))}
          </ul>
        )}
      </main>

      {/* Action principale en bas : zone du pouce. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg">
          <Link
            href="/soumissions/nouveau"
            className="flex h-13 w-full items-center justify-center gap-2 rounded-md bg-ink text-[16px] font-medium text-white active:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Plus size={20} strokeWidth={2} aria-hidden />
            Nouvelle soumission
          </Link>
        </div>
      </div>
    </div>
  );
}

function TabLink({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      replace
      aria-current={active ? "page" : undefined}
      className={`-mb-px flex h-12 items-center justify-center gap-1.5 border-b-2 text-[14px] ${
        active ? "border-ink font-medium text-ink" : "border-transparent text-muted"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="tabular-nums">{count}</span>
    </Link>
  );
}

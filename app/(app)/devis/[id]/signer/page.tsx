import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { QuoteSummary } from "@/components/quote/quote-summary";
import { SignatureForm } from "@/components/signature/signature-form";
import { getInvoice } from "@/lib/data";
import { formatCents } from "@/lib/format";
import { signOnSite } from "../actions";

export default async function SignOnSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  if (invoice.status !== "draft" && invoice.status !== "sent") redirect(`/devis/${id}`);

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-white pb-[calc(100px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-line bg-white px-1 pt-[env(safe-area-inset-top)]">
        <Link href={`/devis/${id}`} aria-label="Retour" className="flex h-12 w-12 items-center justify-center rounded-md active:bg-canvas">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden />
        </Link>
        <h1 className="text-[17px] font-semibold tabular-nums">Devis {invoice.quote_number}</h1>
      </header>

      <QuoteSummary invoice={invoice} />

      <p className="px-4 pb-3 text-[14px] text-muted">
        Bon pour accord. En signant, le client accepte ce devis de {formatCents(invoice.total_cents)} TTC.
      </p>
      <SignatureForm action={signOnSite} fields={{ id: invoice.id }} />
    </div>
  );
}

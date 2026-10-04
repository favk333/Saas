import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { QuoteForm } from "@/components/quote/quote-form";
import { getDefaultTaxBps } from "@/lib/data";

export default async function NewQuotePage() {
  const defaultTaxBps = await getDefaultTaxBps();

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-white">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-line bg-white px-1 pt-[env(safe-area-inset-top)]">
        <Link href="/" aria-label="Retour" className="flex h-12 w-12 items-center justify-center active:bg-canvas rounded-md">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden />
        </Link>
        <h1 className="text-[17px] font-semibold">Nouveau devis</h1>
      </header>
      <QuoteForm defaultTaxBps={defaultTaxBps} />
    </div>
  );
}

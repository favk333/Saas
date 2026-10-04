"use client";

import { TAX_RATES } from "@/lib/quote";

export function TaxRatePicker({ name, value, onChange }: { name: string; value: number; onChange: (bps: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Taux de TVA" className="grid grid-cols-4 rounded-md border border-line p-0.5">
      {TAX_RATES.map((r) => (
        <label key={r.bps}
          className={`flex h-11 cursor-pointer items-center justify-center rounded-[5px] text-[15px] tabular-nums has-focus-visible:outline-2 has-focus-visible:outline-ink ${
            value === r.bps ? "bg-ink font-medium text-white" : "text-ink"
          }`}>
          <input type="radio" name={name} value={r.bps} checked={value === r.bps}
            onChange={() => onChange(r.bps)} className="sr-only" />
          {r.label}
        </label>
      ))}
    </div>
  );
}

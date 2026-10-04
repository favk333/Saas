"use client";

import { TAX_REGIMES, type TaxRegime } from "@/lib/quote";

export function TaxRegimePicker({ name, value, onChange }: { name: string; value: TaxRegime; onChange: (r: TaxRegime) => void }) {
  return (
    <div role="radiogroup" aria-label="Taxes" className="grid grid-cols-2 rounded-md border border-line p-0.5">
      {TAX_REGIMES.map((r) => (
        <label key={r.id}
          className={`flex h-11 cursor-pointer items-center justify-center rounded-[5px] text-[15px] has-focus-visible:outline-2 has-focus-visible:outline-ink ${
            value === r.id ? "bg-ink font-medium text-white" : "text-ink"
          }`}>
          <input type="radio" name={name} value={r.id} checked={value === r.id}
            onChange={() => onChange(r.id)} className="sr-only" />
          {r.label}
        </label>
      ))}
    </div>
  );
}

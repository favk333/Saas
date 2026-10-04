import type { DisplayStatus } from "@/lib/types";

const styles: Record<DisplayStatus, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "border-line text-muted" },
  sent: { label: "Envoyé", className: "border-line text-ink" },
  signed: { label: "Signé", className: "border-ink text-ink" },
  late: { label: "En retard", className: "border-late text-late" },
  paid: { label: "Payé", className: "border-paid text-paid" },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const s = styles[status];
  return (
    <span className={`inline-flex h-5 items-center rounded-sm border px-1.5 text-[12px] font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

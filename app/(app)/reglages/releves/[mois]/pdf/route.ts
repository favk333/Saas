import { isMonth, rowsOfMonth } from "@/lib/commissions";
import { getCommissionRows, getProfile } from "@/lib/data";
import { platformIdentity } from "@/lib/fees";
import { renderStatementPdf } from "@/lib/statement-pdf";

export const dynamic = "force-dynamic";

/** Relevé mensuel des commissions de l'artisan connecté (RLS), en PDF. */
export async function GET(_request: Request, { params }: { params: Promise<{ mois: string }> }) {
  const { mois } = await params;
  if (!isMonth(mois)) return new Response("Mois invalide", { status: 404 });

  const [profile, rows] = await Promise.all([getProfile(), getCommissionRows()]);
  if (!profile) return new Response("Non connecté", { status: 401 });
  const monthRows = rowsOfMonth(rows, mois);
  if (monthRows.length === 0) return new Response("Aucune commission ce mois-ci", { status: 404 });

  const pdf = await renderStatementPdf(mois, monthRows, platformIdentity(), {
    name: profile.company_name,
    address: profile.address,
    neq: profile.neq,
    taxNumbers: profile.tps_number && profile.tvq_number ? { tps: profile.tps_number, tvq: profile.tvq_number } : null,
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Releve-commissions-${mois}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

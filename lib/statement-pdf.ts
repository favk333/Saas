import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { monthLabel, summarize, type CommissionRow } from "./commissions";
import { spacedTaxNumber } from "./fees";

// Même mise en page que les factures (lib/pdf.ts) : A4, Helvetica, noir et gris.
const W = 595.28;
const H = 841.89;
const M = 48;
const INK = rgb(0.067, 0.094, 0.153);
const MUTED = rgb(0.42, 0.447, 0.502);
const LINE = rgb(0.898, 0.906, 0.922);

const cad = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" });
const money = (cents: number) => cad.format(cents / 100);
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Toronto" });

export type StatementParty = {
  name: string;
  address: string | null;
  neq?: string | null;
  taxNumbers: { tps: string; tvq: string } | null;
};

/**
 * Relevé mensuel des commissions : document de la plateforme (fournisseur) à l'artisan (acquéreur),
 * avec les numéros de TPS / TVQ et le détail des taxes, pour ses crédits de taxe.
 */
export async function renderStatementPdf(month: string, rows: CommissionRow[], platform: StatementParty, artisan: StatementParty) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const title = `Relevé des commissions · ${monthLabel(month)}`;
  doc.setTitle(title);
  doc.setAuthor(platform.name);
  doc.setCreator("Chantier");

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const charset = new Set(font.getCharacterSet());
  const clean = (t: string) =>
    [...t.replace(/[   ]/g, " ")].filter((c) => charset.has(c.codePointAt(0)!)).join("");
  const text = (t: string, x: number, yy: number, o: { size?: number; f?: PDFFont; color?: typeof INK; align?: "right" } = {}) => {
    const size = o.size ?? 9;
    const f = o.f ?? font;
    const s = clean(t);
    page.drawText(s, { x: o.align === "right" ? x - f.widthOfTextAtSize(s, size) : x, y: yy, size, font: f, color: o.color ?? INK });
  };
  const rule = (yy: number) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.6, color: LINE });

  // ---- En-tête : plateforme (fournisseur) à gauche, relevé à droite ----
  text(platform.name, M, y, { size: 14, f: bold });
  text("Relevé des commissions", W - M, y, { size: 14, f: bold, align: "right" });
  y -= 18;
  const left = [
    platform.address,
    platform.taxNumbers && `TPS ${spacedTaxNumber(platform.taxNumbers.tps)}`,
    platform.taxNumbers && `TVQ ${spacedTaxNumber(platform.taxNumbers.tvq)}`,
  ].filter(Boolean) as string[];
  const right: [string, string][] = [
    ["Période", monthLabel(month)],
    ["Émis le", date(new Date().toISOString())],
  ];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i]) text(left[i], M, y, { color: MUTED });
    if (right[i]) {
      text(right[i][1], W - M, y, { align: "right" });
      text(right[i][0], W - M - 90, y, { color: MUTED, align: "right" });
    }
    y -= 13;
  }

  // ---- Destinataire : l'artisan ----
  y -= 16;
  text("DESTINATAIRE", M, y, { size: 8, color: MUTED });
  y -= 14;
  text(artisan.name, M, y, { size: 11, f: bold });
  y -= 14;
  for (const l of [
    artisan.address,
    artisan.neq && `NEQ ${artisan.neq}`,
    artisan.taxNumbers && `TPS ${spacedTaxNumber(artisan.taxNumbers.tps)} · TVQ ${spacedTaxNumber(artisan.taxNumbers.tvq)}`,
  ].filter(Boolean) as string[]) {
    text(l, M, y, { color: MUTED });
    y -= 13;
  }

  // ---- Détail des paiements ----
  const cols = { date: M, invoice: M + 72, payment: 318, fee: 384, tps: 432, tvq: 484, total: W - M };
  const header = () => {
    text("DATE", cols.date, y, { size: 7.5, color: MUTED });
    text("FACTURE", cols.invoice, y, { size: 7.5, color: MUTED });
    text("PAIEMENT", cols.payment, y, { size: 7.5, color: MUTED, align: "right" });
    text("COMMISSION", cols.fee, y, { size: 7.5, color: MUTED, align: "right" });
    text("TPS", cols.tps, y, { size: 7.5, color: MUTED, align: "right" });
    text("TVQ", cols.tvq, y, { size: 7.5, color: MUTED, align: "right" });
    text("TOTAL", cols.total, y, { size: 7.5, color: MUTED, align: "right" });
    y -= 8;
    rule(y);
  };
  y -= 22;
  header();

  for (const r of rows) {
    if (y < M + 120) {
      page = doc.addPage([W, H]);
      y = H - M;
      header();
    }
    y -= 14;
    const tps = r.platform_fee_tps_cents ?? 0;
    const tvq = r.platform_fee_tvq_cents ?? 0;
    text(date(r.paid_at), cols.date, y);
    text(r.invoice_number, cols.invoice, y);
    text(money(r.total_cents), cols.payment, y, { align: "right" });
    text(money(r.platform_fee_cents), cols.fee, y, { align: "right" });
    text(money(tps), cols.tps, y, { align: "right" });
    text(money(tvq), cols.tvq, y, { align: "right" });
    text(money(r.platform_fee_cents + tps + tvq), cols.total, y, { align: "right" });
    y -= 7;
    rule(y);
  }

  // ---- Totaux ----
  const s = summarize(month, rows);
  y -= 20;
  const total = (label: string, cents: number, strong = false) => {
    text(label, cols.tvq, y, { align: "right", color: strong ? INK : MUTED, f: strong ? bold : font, size: strong ? 10.5 : 9 });
    text(money(cents), cols.total, y, { align: "right", f: strong ? bold : font, size: strong ? 10.5 : 9 });
    y -= strong ? 18 : 13;
  };
  total(`Paiements encaissés (${s.count})`, s.payments);
  total("Commissions", s.fee);
  total("TPS sur les commissions", s.tps);
  total("TVQ sur les commissions", s.tvq);
  total("Total prélevé", s.total, true);

  // ---- Notes ----
  y -= 10;
  const notes = [
    "Commission prélevée par Stripe sur chaque paiement en ligne encaissé dans le mois (heure de Montréal). Montants en dollars canadiens.",
    s.tps || s.tvq
      ? `TPS et TVQ facturées par ${platform.name} sur ses commissions.`
      : "Aucune TPS ni TVQ facturée sur ces commissions.",
  ];
  for (const n of notes) {
    text(n, M, y, { size: 8, color: MUTED });
    y -= 11;
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    page = p;
    text(`${platform.name} · ${title}`, M, M - 20, { size: 7.5, color: MUTED });
    text(`${i + 1}/${pages.length}`, W - M, M - 20, { size: 7.5, color: MUTED, align: "right" });
  });

  return doc.save();
}

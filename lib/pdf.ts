import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { formatRbq } from "./identifiers";
import { TPS_LABEL, TVQ_LABEL } from "./quote";
import type { InvoiceDetail } from "./types";

export type Seller = {
  company_name: string;
  address: string | null;
  phone: string | null;
  neq: string | null;
  rbq_licence: string | null;
  tps_number: string | null;
  tvq_number: string | null;
  insurance: string | null;
};

// A4 en points, marges 48 pt.
const W = 595.28;
const H = 841.89;
const M = 48;
const INK = rgb(0.067, 0.094, 0.153); // #111827
const MUTED = rgb(0.42, 0.447, 0.502); // #6B7280
const LINE = rgb(0.898, 0.906, 0.922); // #E5E7EB

const cad = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" });
// Format québécois AAAA-MM-JJ, à l'heure de Montréal.
const date = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Toronto" });
const money = (cents: number) => cad.format(cents / 100);
const qty = (q: number) => q.toLocaleString("fr-CA", { maximumFractionDigits: 2 });
/** "123456789RT0001" → "123456789 RT0001" */
const regNumber = (n: string) => n.replace(/^(\d+)([A-Z]{2}\d{4})$/, "$1 $2");
const phone = (e164: string) =>
  /^\+1\d{10}$/.test(e164)
    ? e164.slice(2).replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2-$3")
    : e164.replace(/^\+33/, "0").replace(/(\d{2})(?=\d)/g, "$1 ");

/**
 * Devis (avant signature) ou facture (après), avec les mentions obligatoires :
 * identité du vendeur et numéros de TPS / TVQ, numéro, dates, sous-total,
 * TPS et TVQ ligne par ligne, total, échéance, assurance, signature du client.
 */
export async function renderInvoicePdf(invoice: InvoiceDetail, seller: Seller, signaturePng: Uint8Array | null) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const isInvoice = Boolean(invoice.invoice_number);
  const title = isInvoice ? `Facture ${invoice.invoice_number}` : `Devis ${invoice.quote_number}`;
  doc.setTitle(title);
  doc.setAuthor(seller.company_name);
  doc.setCreator("Chantier");

  let page = doc.addPage([W, H]);
  let y = H - M;

  // Les polices standard PDF ne couvrent que WinAnsi : on retire le reste (emoji…)
  // et on remplace les espaces fines de Intl, au lieu de faire échouer la génération.
  const charset = new Set(font.getCharacterSet());
  const clean = (t: string) =>
    [...t.replace(/[\u202f\u00a0\u2009]/g, " ")]
      .filter((c) => charset.has(c.codePointAt(0)!))
      .join("")
      .replace(/ {2,}/g, " ");

  const text = (t: string, x: number, yy: number, o: { size?: number; f?: PDFFont; color?: typeof INK; align?: "right" } = {}) => {
    const size = o.size ?? 9.5;
    const f = o.f ?? font;
    const s = clean(t);
    const dx = o.align === "right" ? f.widthOfTextAtSize(s, size) : 0;
    page.drawText(s, { x: x - dx, y: yy, size, font: f, color: o.color ?? INK });
  };
  const rule = (yy: number, x1 = M, x2 = W - M) =>
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: 0.6, color: LINE });
  const wrap = (t: string, width: number, size = 9.5, f: PDFFont = font) => {
    const lines: string[] = [];
    for (const para of clean(t).split("\n")) {
      let cur = "";
      for (const word of para.split(/\s+/)) {
        const next = cur ? `${cur} ${word}` : word;
        if (f.widthOfTextAtSize(next, size) <= width || !cur) cur = next;
        else { lines.push(cur); cur = word; }
      }
      lines.push(cur);
    }
    return lines;
  };
  let onNewPage = () => {};
  const ensure = (needed: number) => {
    if (y - needed >= M + 24) return;
    page = doc.addPage([W, H]);
    y = H - M;
    onNewPage();
  };

  // ---- En-tête : vendeur à gauche, document à droite ----
  text(seller.company_name, M, y, { size: 14, f: bold });
  text(title, W - M, y, { size: 14, f: bold, align: "right" });
  y -= 18;
  const sellerLines = [
    seller.address,
    seller.phone && `Tél. ${phone(seller.phone)}`,
    seller.neq && `NEQ ${seller.neq}`,
    seller.rbq_licence && `Licence RBQ ${formatRbq(seller.rbq_licence)}`,
    seller.tps_number && `TPS ${regNumber(seller.tps_number)}`,
    seller.tvq_number && `TVQ ${regNumber(seller.tvq_number)}`,
  ].filter(Boolean) as string[];
  const docLines: [string, string][] = [
    [isInvoice ? "Date d'émission" : "Date", date(invoice.signed_at ?? invoice.created_at)],
    ...(isInvoice ? [["Devis", invoice.quote_number] as [string, string]] : []),
    ...(isInvoice && invoice.due_at ? [["Échéance", date(invoice.due_at)] as [string, string]] : []),
    ...(!isInvoice ? [["Validité", "30 jours"] as [string, string]] : []),
  ];
  const headerRows = Math.max(sellerLines.length, docLines.length);
  for (let i = 0; i < headerRows; i++) {
    if (sellerLines[i]) text(sellerLines[i], M, y, { color: MUTED });
    if (docLines[i]) {
      text(docLines[i][1], W - M, y, { align: "right" });
      text(docLines[i][0], W - M - 90, y, { color: MUTED, align: "right" });
    }
    y -= 13;
  }

  // ---- Client ----
  y -= 18;
  text("CLIENT", M, y, { size: 8, color: MUTED });
  y -= 14;
  text(invoice.client.name, M, y, { size: 11, f: bold });
  y -= 14;
  if (invoice.site_address) {
    text(`Chantier : ${invoice.site_address}`, M, y, { color: MUTED });
    y -= 13;
  }

  // ---- Lignes ----
  const cQty = W - M - 200;
  const cUnit = W - M - 90;
  const cTotal = W - M;
  const descWidth = cQty - 40 - M;
  const tableHeader = () => {
    text("DÉSIGNATION", M, y, { size: 8, color: MUTED });
    text("QTÉ", cQty, y, { size: 8, color: MUTED, align: "right" });
    text("PRIX UNIT.", cUnit, y, { size: 8, color: MUTED, align: "right" });
    text("MONTANT", cTotal, y, { size: 8, color: MUTED, align: "right" });
    y -= 8;
    rule(y);
  };
  y -= 20;
  tableHeader();
  onNewPage = tableHeader; // en-tête répété si le tableau continue page suivante

  for (const li of invoice.line_items) {
    const lines = wrap(li.description, descWidth);
    ensure(lines.length * 12 + 10);
    y -= 15;
    lines.forEach((l, i) => text(l, M, y - i * 12));
    text(qty(li.quantity), cQty, y, { align: "right" });
    text(money(li.unit_price_cents), cUnit, y, { align: "right" });
    text(money(li.total_cents), cTotal, y, { align: "right" });
    y -= (lines.length - 1) * 12 + 8;
    rule(y);
  }

  // ---- Totaux ----
  onNewPage = () => {};
  ensure(70);
  y -= 18;
  const totalRow = (label: string, value: string, strong = false) => {
    text(label, cUnit, y, { color: strong ? INK : MUTED, f: strong ? bold : font, size: strong ? 11 : 9.5, align: "right" });
    text(value, cTotal, y, { f: strong ? bold : font, size: strong ? 11 : 9.5, align: "right" });
    y -= strong ? 18 : 14;
  };
  totalRow("Sous-total", money(invoice.subtotal_cents));
  if (invoice.tax_regime === "qc") {
    totalRow(TPS_LABEL, money(invoice.tps_cents));
    totalRow(TVQ_LABEL, money(invoice.tvq_cents));
  }
  totalRow("Total", money(invoice.total_cents), true);
  if (invoice.tax_regime === "exempt") {
    text("Taxes non applicables : fournisseur non inscrit à la TPS et à la TVQ", cTotal, y, { size: 8.5, color: MUTED, align: "right" });
    y -= 14;
  }

  // ---- Conditions ----
  const terms: string[] = [];
  if (isInvoice) {
    if (invoice.paid_at) terms.push(`Facture acquittée le ${date(invoice.paid_at)}.`);
    else if (invoice.due_at) terms.push(`Paiement à réception, au plus tard le ${date(invoice.due_at)}.`);
  } else {
    terms.push("Devis valable 30 jours. Les travaux débutent après acceptation signée.");
  }
  if (seller.insurance) terms.push(`Assurance : ${seller.insurance}.`);

  y -= 16;
  for (const t of terms) {
    const lines = wrap(t, W - 2 * M, 8.5);
    ensure(lines.length * 11);
    lines.forEach((l) => {
      text(l, M, y, { size: 8.5, color: MUTED });
      y -= 11;
    });
    y -= 3;
  }

  // ---- Signature du client ----
  if (invoice.signed_at) {
    ensure(110);
    y -= 14;
    text("ACCEPTATION DU CLIENT", M, y, { size: 8, color: MUTED });
    y -= 13;
    const how = invoice.signed_via === "remote" ? "en ligne" : "sur place";
    text(`Signé ${how} par ${invoice.client.name} le ${date(invoice.signed_at)}`, M, y);
    if (signaturePng) {
      const img = await doc.embedPng(signaturePng);
      const scale = Math.min(180 / img.width, 60 / img.height);
      y -= 8 + img.height * scale;
      page.drawImage(img, { x: M, y, width: img.width * scale, height: img.height * scale });
    }
  }

  // ---- Pied de page ----
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    page = p as PDFPage;
    const ids = [seller.neq && `NEQ ${seller.neq}`, seller.rbq_licence && `RBQ ${formatRbq(seller.rbq_licence)}`].filter(Boolean);
    text([seller.company_name, ...ids].join(" · "), M, M - 20, { size: 7.5, color: MUTED });
    text(`${title} · ${i + 1}/${pages.length}`, W - M, M - 20, { size: 7.5, color: MUTED, align: "right" });
  });

  return doc.save();
}

export function pdfFilename(invoice: Pick<InvoiceDetail, "invoice_number" | "quote_number">) {
  return invoice.invoice_number ? `Facture-${invoice.invoice_number}.pdf` : `Devis-${invoice.quote_number}.pdf`;
}

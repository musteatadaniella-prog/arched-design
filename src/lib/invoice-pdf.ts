import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Company } from "./company";

// Draws one A4 invoice. Noto Sans is embedded so ă, â, î, ș, ț print correctly
// (the standard PDF fonts have no Romanian letters).

export type InvoiceForPdf = {
  number: string;
  issued_on: string; // YYYY-MM-DD
  due_on: string;
  currency: string;
  total: number;
  items: { title: string; qty: number; unit_price: number; amount: number }[];
  client: { name: string; phone: string | null; email: string | null; telegram: string | null };
};

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");
let fonts: Promise<[Uint8Array, Uint8Array]> | null = null;
const loadFonts = () =>
  (fonts ??= Promise.all([
    readFile(path.join(FONT_DIR, "NotoSans-Regular.ttf")),
    readFile(path.join(FONT_DIR, "NotoSans-Bold.ttf")),
  ]));

const INK = rgb(0.11, 0.11, 0.1);
const SOFT = rgb(0.38, 0.37, 0.35);
const LINE = rgb(0.82, 0.8, 0.76);
const SAND = rgb(0.93, 0.9, 0.84);

const W = 595.28;
const H = 841.89;
const M = 48; // page margin

const day = (iso: string) => iso.split("-").reverse().join(".");
const num = (n: number) =>
  new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(n)
    .replace(/[  ]/g, " ");
const qtyFmt = (n: number) => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(n);

// Splits text into lines no wider than `width`.
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export async function renderInvoicePdf(inv: InvoiceForPdf, seller: Company): Promise<Uint8Array> {
  const [regBytes, boldBytes] = await loadFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const reg = await doc.embedFont(regBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  doc.setTitle(`Factura ${inv.number}`);
  doc.setAuthor(seller.name);
  doc.setCreator("Arched Design CRM");

  let page: PDFPage = doc.addPage([W, H]);
  const text = (s: string, x: number, y: number, size = 9.5, font = reg, color = INK) =>
    page.drawText(s, { x, y, size, font, color });
  const right = (s: string, xRight: number, y: number, size = 9.5, font = reg, color = INK) =>
    text(s, xRight - font.widthOfTextAtSize(s, size), y, size, font, color);

  // Header
  let y = H - M - 10;
  text("ARCHED DESIGN", M, y, 20, bold);
  text("Birou de arhitectură și design interior", M, y - 16, 9, reg, SOFT);
  right("FACTURĂ", W - M, y, 20, bold);
  right(`Nr. ${inv.number}`, W - M, y - 16, 10, bold);

  y -= 44;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: INK });

  // Dates
  y -= 22;
  const dates: [string, string][] = [
    ["Data emiterii", day(inv.issued_on)],
    ["Termen de plată", day(inv.due_on)],
    ["Valuta", inv.currency],
  ];
  dates.forEach(([k, v], i) => {
    const x = M + i * 140;
    text(k.toUpperCase(), x, y, 7.5, reg, SOFT);
    text(v, x, y - 14, 11, bold);
  });

  // Parties
  y -= 50;
  const colW = (W - 2 * M - 24) / 2;
  const party = (title: string, lines: string[], x: number) => {
    let yy = y;
    text(title.toUpperCase(), x, yy, 7.5, bold, SOFT);
    yy -= 15;
    lines.forEach((l, i) => {
      for (const part of wrap(l, i === 0 ? bold : reg, i === 0 ? 10.5 : 9, colW)) {
        text(part, x, yy, i === 0 ? 10.5 : 9, i === 0 ? bold : reg);
        yy -= i === 0 ? 14 : 12.5;
      }
    });
    return yy;
  };
  const sellerEnd = party(
    "Furnizor",
    [
      seller.name,
      `IDNO: ${seller.idno}`,
      seller.vat ? `Cod TVA: ${seller.vat}` : "",
      seller.address,
      `IBAN: ${seller.iban}`,
      `${seller.bank}, BIC ${seller.bic}`,
      `${seller.email} · ${seller.phone}`,
    ].filter(Boolean),
    M,
  );
  const c = inv.client;
  const clientEnd = party(
    "Client",
    [c.name, c.phone ? `Telefon: ${c.phone}` : "", c.email ? `Email: ${c.email}` : "", c.telegram ? `Telegram: ${c.telegram}` : ""].filter(
      Boolean,
    ),
    M + colW + 24,
  );
  y = Math.min(sellerEnd, clientEnd) - 18;

  // Lines table
  const cols = { no: M + 8, title: M + 34, qtyR: W - M - 190, priceR: W - M - 100, sumR: W - M - 8 };
  const titleW = cols.qtyR - 50 - cols.title;
  const header = () => {
    page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: 22, color: SAND });
    text("Nr.", cols.no, y, 8, bold);
    text("Denumire", cols.title, y, 8, bold);
    right("Cant.", cols.qtyR, y, 8, bold);
    right(`Preț, ${inv.currency}`, cols.priceR, y, 8, bold);
    right(`Suma, ${inv.currency}`, cols.sumR, y, 8, bold);
    y -= 26;
  };
  header();

  inv.items.forEach((it, i) => {
    const lines = wrap(it.title, reg, 9.5, titleW);
    const rowH = lines.length * 12.5 + 10;
    if (y - rowH < M + 140) {
      page = doc.addPage([W, H]);
      y = H - M;
      header();
    }
    text(String(i + 1), cols.no, y, 9.5);
    lines.forEach((l, j) => text(l, cols.title, y - j * 12.5, 9.5));
    right(qtyFmt(it.qty), cols.qtyR, y, 9.5);
    right(num(it.unit_price), cols.priceR, y, 9.5);
    right(num(it.amount), cols.sumR, y, 9.5);
    // Separator just under the last text line, then the next row below it.
    const lineY = y - (lines.length - 1) * 12.5 - 7;
    page.drawLine({ start: { x: M, y: lineY }, end: { x: W - M, y: lineY }, thickness: 0.5, color: LINE });
    y = lineY - 15;
  });

  // Total
  y -= 14;
  right("TOTAL DE PLATĂ", cols.priceR, y, 9, bold, SOFT);
  right(`${num(inv.total)} ${inv.currency}`, cols.sumR, y - 2, 14, bold);
  y -= 34;
  text(`Vă rugăm să achitați până la ${day(inv.due_on)} prin transfer bancar.`, M, y, 9.5);
  text(`În destinația plății indicați: „Achitare factura ${inv.number}”.`, M, y - 13, 9.5);

  // Footer
  page.drawLine({ start: { x: M, y: M + 18 }, end: { x: W - M, y: M + 18 }, thickness: 0.5, color: LINE });
  text(`${seller.name} · ${seller.address}`, M, M + 5, 7.5, reg, SOFT);
  right(`Factura ${inv.number}`, W - M, M + 5, 7.5, reg, SOFT);

  return doc.save();
}

/**
 * A4 print templates (letter, report, invoice) built with the `docx` package.
 * Pure module (no DOM): the /design page packs it to a Blob, and
 * scripts/gen-print-templates.mjs can pack it to files for checking.
 *
 * Header and footer are real Word header/footer parts; the logo is the
 * wordmark rendered to PNG (passed in by the caller).
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
  type TableVerticalAlign,
  type ParagraphChild,
} from "docx";

import { FOOTER_ALL, FOOTER_COLS, PRINT_BRAND, footerColumn, money, parseItems, type FooterCols, type PrintData, type PrintKind } from "./printData";

/** A4 in twips (1/1440 in) and the page margins used by every template. */
export const A4 = { width: 11906, height: 16838 };
const MARGIN = { top: 2155, bottom: 1985, left: 1247, right: 1247, header: 624, footer: 567 }; // 38 / 35 / 22 / 22 / 11 / 10 mm
const CONTENT_W = A4.width - MARGIN.left - MARGIN.right;

const NONE: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const CELL_NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };

const run = (text: string, o: { size?: number; bold?: boolean; color?: string; caps?: boolean } = {}) =>
  new TextRun({ text, font: PRINT_BRAND.font, size: o.size ?? 20, bold: o.bold, color: o.color ?? PRINT_BRAND.ink, allCaps: o.caps });

const para = (children: ParagraphChild[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; before?: number; line?: number } = {}) =>
  new Paragraph({ children, alignment: o.align, spacing: { after: o.after ?? 0, before: o.before ?? 0, line: o.line ?? 276 } });

const lines = (text: string) => text.split("\n");

function cell(children: Paragraph[], width: number, o: { fill?: string; valign?: TableVerticalAlign; borders?: Record<string, IBorderOptions>; margins?: boolean } = {}) {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    borders: o.borders ?? CELL_NO_BORDERS,
    verticalAlign: o.valign ?? VerticalAlign.TOP,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    margins: o.margins === false ? { top: 0, bottom: 0, left: 0, right: 0 } : { top: 80, bottom: 80, left: 100, right: 100 },
  });
}

function table(widths: number[], rows: TableCell[][]) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: rows.map((cells) => new TableRow({ children: cells })),
  });
}

/* ---------- header & footer ---------- */
export type LogoPng = { data: Uint8Array; width: number; height: number };

function header(kind: PrintKind, d: PrintData, logo: LogoPng) {
  const logoW = 165; // px at 96 dpi ≈ 44 mm
  const logoH = Math.round((logoW * logo.height) / logo.width);
  const right: Paragraph[] =
    kind === "invoice"
      ? [
          para([run("INVOICE", { size: 30, bold: true, color: PRINT_BRAND.accent })], { align: AlignmentType.RIGHT }),
          para([run(d.invoiceNo, { size: 17, color: PRINT_BRAND.ink2 })], { align: AlignmentType.RIGHT }),
        ]
      : kind === "report"
        ? [
            para([run(d.title, { size: 17, bold: true })], { align: AlignmentType.RIGHT }),
            para([run(d.date, { size: 17, color: PRINT_BRAND.ink2 })], { align: AlignmentType.RIGHT }),
          ]
        : [
            para([run(d.web, { size: 16, color: PRINT_BRAND.ink2 })], { align: AlignmentType.RIGHT }),
            para([run(d.email, { size: 16, color: PRINT_BRAND.ink2 })], { align: AlignmentType.RIGHT }),
            para([run(d.phone, { size: 16, color: PRINT_BRAND.ink2 })], { align: AlignmentType.RIGHT }),
          ];
  const half = CONTENT_W / 2;
  return new Header({
    children: [
      table([half, half], [[
        cell([para([new ImageRun({ type: "png", data: logo.data, transformation: { width: logoW, height: logoH }, altText: { name: "Bioversee", title: "Bioversee", description: "Bioversee wordmark" } })])], half, { valign: VerticalAlign.BOTTOM, margins: false }),
        cell(right, half, { valign: VerticalAlign.BOTTOM, margins: false }),
      ]]),
      // Accent rule: short teal bar on a hairline (like the site's accent underline).
      new Paragraph({
        spacing: { before: 160, after: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: PRINT_BRAND.line, space: 1 } },
        children: [],
      }),
      new Paragraph({
        spacing: { before: 0, after: 0, line: 120 },
        indent: { right: CONTENT_W - 1134 },
        border: { top: { style: BorderStyle.SINGLE, size: 18, color: PRINT_BRAND.accent, space: 0 } },
        children: [],
      }),
    ],
  });
}

function footer(d: PrintData, cols: FooterCols) {
  // Fixed quarter-width columns; disabled ones are dropped so the rest pack to the left margin.
  const w = Math.floor(CONTENT_W / 4);
  const on = FOOTER_COLS.filter((c) => cols[c.id]);
  const col = (title: string, rows: string[]) => [
    para([run(title, { size: 14, bold: true, color: PRINT_BRAND.accent, caps: true })], { after: 40 }),
    ...rows.map((r) => para([run(r, { size: 14, color: PRINT_BRAND.ink2 })], { line: 240 })),
  ];
  const page = new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { line: 240 },
    children: [new TextRun({ font: PRINT_BRAND.font, size: 14, color: PRINT_BRAND.ink3, children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES] })],
  });
  const grid = on.length
    ? [
        new Table({
          width: { size: w * on.length, type: WidthType.DXA },
          columnWidths: on.map(() => w),
          layout: TableLayoutType.FIXED,
          alignment: AlignmentType.LEFT,
          indent: { size: 0, type: WidthType.DXA },
          borders: NO_BORDERS,
          rows: [new TableRow({ children: on.map((c) => { const f = footerColumn(c.id, d); return cell(col(f.title, f.rows), w, { margins: false }); }) })],
        }),
      ]
    : [];
  return new Footer({
    children: [
      new Paragraph({ spacing: { after: 120 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: PRINT_BRAND.line, space: 1 } }, children: [] }),
      ...grid,
      page,
    ],
  });
}

/* ---------- bodies ---------- */
const bodyParas = (text: string, after = 160) =>
  text.split(/\n\s*\n/).map((p) => new Paragraph({ spacing: { after, line: 300 }, children: lines(p).flatMap((l, i) => (i ? [new TextRun({ break: 1 }), run(l)] : [run(l)])) }));

function letterBody(d: PrintData) {
  return [
    // DIN-style sender line above the address window
    para([run(`${d.company} · ${d.street} · ${d.city}`, { size: 13, color: PRINT_BRAND.ink3 })], { after: 80 }),
    ...lines(d.recipient).map((l) => para([run(l)], { line: 260 })),
    para([run(d.date, { color: PRINT_BRAND.ink2 })], { align: AlignmentType.RIGHT, before: 480, after: 0 }),
    para([run(`Ref. ${d.reference}`, { size: 16, color: PRINT_BRAND.ink3 })], { align: AlignmentType.RIGHT, after: 360 }),
    para([run(d.subject, { size: 24, bold: true })], { after: 280 }),
    ...bodyParas(d.body),
    para([], { after: 600 }),
    para([run(d.signer, { bold: true })]),
    para([run(d.signerRole, { color: PRINT_BRAND.ink2 })]),
  ];
}

function reportBody(d: PrintData) {
  const h = (t: string) => para([run(t, { size: 26, bold: true })], { before: 360, after: 120 });
  return [
    para([run(d.title, { size: 52, bold: true })], { after: 80, line: 240 }),
    para([run(d.subtitle, { size: 26, color: PRINT_BRAND.accent })], { after: 120 }),
    para([run(`${d.date}  ·  ${d.reference}  ·  ${d.signer}`, { size: 16, color: PRINT_BRAND.ink3 })], { after: 360 }),
    h("1  Summary"),
    ...bodyParas(d.body),
    h("2  Details"),
    ...bodyParas("[Method, results or scope. Use short paragraphs and headings so the document scans well.]"),
    ...["[Key point]", "[Key point]", "[Key point]"].map((t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60, line: 276 }, children: [run(t)] })),
  ];
}

function invoiceBody(d: PrintData) {
  const items = parseItems(d.items);
  const sub = items.reduce((a, b) => a + b.total, 0);
  const rate = Number(d.vatRate.replace(",", ".")) || 0;
  const vat = (sub * rate) / 100;
  const half = CONTENT_W / 2;
  const meta: [string, string][] = [["Invoice no.", d.invoiceNo], ["Date", d.date], ["Due", d.dueDate], ["Reference", d.reference]];
  const W = [CONTENT_W - 900 - 1700 - 1700, 900, 1700, 1700];
  const line = { top: NONE, left: NONE, right: NONE, bottom: { style: BorderStyle.SINGLE, size: 4, color: PRINT_BRAND.line } };
  const th = (t: string, i: number) => cell([para([run(t, { size: 16, bold: true, color: "FFFFFF" })], { align: i ? AlignmentType.RIGHT : AlignmentType.LEFT })], W[i], { fill: PRINT_BRAND.accent });
  const td = (t: string, i: number, bold = false) => cell([para([run(t, { bold })], { align: i ? AlignmentType.RIGHT : AlignmentType.LEFT })], W[i], { borders: line });
  const total = (label: string, value: string, strong = false) =>
    new Paragraph({
      indent: { left: half },
      tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W - 100 }],
      spacing: { before: strong ? 120 : 60, after: 0, line: 276 },
      border: strong ? { top: { style: BorderStyle.SINGLE, size: 8, color: PRINT_BRAND.ink, space: 6 } } : undefined,
      children: [run(label, { color: strong ? PRINT_BRAND.ink : PRINT_BRAND.ink2, bold: strong }), new TextRun({ text: "\t" }), run(value, { bold: strong, size: strong ? 24 : 20 })],
    });
  return [
    table([half, half], [[
      cell([
        para([run("Bill to", { size: 14, bold: true, caps: true, color: PRINT_BRAND.accent })], { after: 60 }),
        ...lines(d.recipient).map((l) => para([run(l)], { line: 260 })),
      ], half, { margins: false }),
      cell(meta.map(([k, v]) => new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: half - 100 }], spacing: { line: 300 }, children: [run(k, { color: PRINT_BRAND.ink2 }), new TextRun({ text: "\t" }), run(v)] })), half, { margins: false }),
    ]]),
    para([run(d.subject, { size: 24, bold: true })], { before: 480, after: 200 }),
    table(W, [
      ["Description", "Qty", "Unit price", "Amount"].map(th),
      ...items.map((it) => [td(it.desc, 0), td(String(it.qty), 1), td(money(it.price, d.currency), 2), td(money(it.total, d.currency), 3)]),
    ]),
    para([], { after: 120 }),
    total("Subtotal", money(sub, d.currency)),
    total(`VAT ${rate} %`, money(vat, d.currency)),
    total("Total due", money(sub + vat, d.currency), true),
    para([run("Payment", { size: 14, bold: true, caps: true, color: PRINT_BRAND.accent })], { before: 480, after: 60 }),
    para([run(`Please transfer the total by ${d.dueDate} to ${d.bank}, IBAN ${d.iban}, BIC ${d.bic}, quoting ${d.invoiceNo}.`)], { line: 300 }),
  ];
}

/** Build the Word document for a template. */
export function buildPrintDocument(kind: PrintKind, d: PrintData, logo: LogoPng, cols: FooterCols = FOOTER_ALL) {
  const children = kind === "letter" ? letterBody(d) : kind === "report" ? reportBody(d) : invoiceBody(d);
  return new Document({
    creator: d.company,
    title: kind === "report" ? d.title : kind === "invoice" ? `Invoice ${d.invoiceNo}` : d.subject,
    styles: {
      default: { document: { run: { font: PRINT_BRAND.font, size: 20, color: PRINT_BRAND.ink } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4.width, height: A4.height },
            margin: MARGIN,
          },
        },
        headers: { default: header(kind, d, logo) },
        footers: { default: footer(d, cols) },
        children,
      },
    ],
  });
}

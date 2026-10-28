/** A4 print templates — data, placeholders and brand values (no docx dependency, safe to import eagerly). */
export type PrintKind = "letter" | "report" | "invoice";

export type PrintData = {
  company: string;
  street: string;
  city: string;
  country: string;
  email: string;
  web: string;
  phone: string;
  regNo: string;
  vatId: string;
  bank: string;
  iban: string;
  bic: string;
  // document
  date: string;
  reference: string;
  recipient: string; // multi-line
  subject: string;
  body: string; // paragraphs separated by blank lines
  signer: string;
  signerRole: string;
  // report
  title: string;
  subtitle: string;
  // invoice
  invoiceNo: string;
  dueDate: string;
  items: string; // one per line: description; qty; unit price
  vatRate: string; // percent
  currency: string;
};

export const PRINT_KINDS: { id: PrintKind; label: string }[] = [
  { id: "letter", label: "Letter" },
  { id: "report", label: "Report" },
  { id: "invoice", label: "Invoice" },
];

/** Placeholders only — no real address data lives in the repo. */
export const PRINT_DEFAULTS: PrintData = {
  company: "Bioversee",
  street: "[Street and number]",
  city: "[Postcode City]",
  country: "[Country]",
  email: "hello@bioversee.com",
  web: "www.bioversee.com",
  phone: "[Phone]",
  regNo: "[Company register no.]",
  vatId: "[VAT ID]",
  bank: "[Bank]",
  iban: "[IBAN]",
  bic: "[BIC]",
  date: "[Date]",
  reference: "[Reference]",
  recipient: "[Recipient name]\n[Company]\n[Street and number]\n[Postcode City]\n[Country]",
  subject: "[Subject]",
  body: "",
  signer: "[Name]",
  signerRole: "[Role], Bioversee",
  title: "[Document title]",
  subtitle: "[Subtitle or project]",
  invoiceNo: "[INV-0001]",
  dueDate: "[Due date]",
  items: "[Service or product]; 1; 0.00\n[Service or product]; 2; 0.00",
  vatRate: "20",
  currency: "EUR",
};

/* ---------- brand ---------- */
export const PRINT_BRAND = {
  ink: "1D1D1F",
  ink2: "6E6E73",
  ink3: "86868B",
  accent: "0D9488",
  line: "E8E8ED",
  tint: "F5F5F7",
  font: "Arial", // Outfit is not a standard Office font; Arial keeps the files portable.
};


/** Body text per template (set when switching templates). */
export const PRINT_BODY: Record<PrintKind, string> = {
  letter: "Dear [Name],\n\n[First paragraph: what this is about and what you need from the reader.]\n\n[Second paragraph with the details.]\n\nKind regards,",
  report: "[Summary: the question, the answer and what happens next — in three or four sentences.]",
  invoice: "",
};

export function parseItems(items: string) {
  return items
    .split("\n")
    .map((l) => l.split(";").map((s) => s.trim()))
    .filter((p) => p[0])
    .map(([desc, qty = "1", price = "0"]) => {
      const q = Number(qty.replace(",", ".")) || 0;
      const p = Number(price.replace(",", ".")) || 0;
      return { desc, qty: q, price: p, total: q * p };
    });
}
export const money = (n: number, cur: string) => `${n.toFixed(2)} ${cur}`;


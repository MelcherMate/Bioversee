import { useEffect, useRef, useState, type ReactNode } from "react";
import { LOGO_WORDMARK, WORDMARK_RATIO } from "../../components/BrandLogo/logoSvgs";
import SegmentedControl from "../../components/SegmentedControl";
import { FOOTER_ALL, FOOTER_COLS, footerColumn, money, parseItems, PRINT_BODY, PRINT_BRAND, PRINT_DEFAULTS, PRINT_KINDS, type FooterCol, type FooterCols, type PrintData, type PrintKind } from "./printData";
import "./PrintTemplates.css";

/** Light-theme wordmark (fixed colours) — the same SVG as the site, rasterised for Word. */
const WORDMARK_LIGHT = LOGO_WORDMARK.replace(/var\(--bv-logo-track, ?[\d.]+\)/g, "0.2")
  .replace(/var\(--bv-text\)/g, `#${PRINT_BRAND.ink}`)
  .replace(/var\(--bv-accent\)/g, `#${PRINT_BRAND.accent}`);
const WORDMARK_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(WORDMARK_LIGHT)}`;

async function wordmarkPng(width = 1600) {
  const img = new Image();
  img.src = WORDMARK_SRC;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = width;
  c.height = Math.round(width / WORDMARK_RATIO);
  c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!blob) throw new Error("PNG export failed");
  return { data: new Uint8Array(await blob.arrayBuffer()), width: c.width, height: c.height };
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`auth-field tpl-field${wide ? " pt-wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const lines = (t: string) => t.split("\n");
const paras = (t: string) => t.split(/\n\s*\n/).filter((p) => p.trim());

/** HTML mirror of the Word layout (mm units on a 210 × 297 mm sheet). */
function A4Preview({ kind, d, cols }: { kind: PrintKind; d: PrintData; cols: FooterCols }) {
  const items = parseItems(d.items);
  const sub = items.reduce((a, b) => a + b.total, 0);
  const rate = Number(d.vatRate.replace(",", ".")) || 0;
  return (
    <div className="pt-page" aria-label={`A4 ${kind} preview`}>
      <header className="pt-head">
        <img src={WORDMARK_SRC} alt="Bioversee" className="pt-logo" />
        <div className="pt-head__right">
          {kind === "invoice" ? (
            <><b className="pt-invoice">INVOICE</b><span>{d.invoiceNo}</span></>
          ) : kind === "report" ? (
            <><b>{d.title}</b><span>{d.date}</span></>
          ) : (
            <><span>{d.web}</span><span>{d.email}</span><span>{d.phone}</span></>
          )}
        </div>
      </header>
      <div className="pt-rule" />

      <main className="pt-body">
        {kind === "letter" ? (
          <>
            <p className="pt-sender">{d.company} · {d.street} · {d.city}</p>
            <p className="pt-addr">{lines(d.recipient).map((l, i) => <span key={i}>{l}</span>)}</p>
            <p className="pt-date">{d.date}<small>Ref. {d.reference}</small></p>
            <h4 className="pt-subject">{d.subject}</h4>
            {paras(d.body).map((p, i) => <p key={i}>{lines(p).map((l, j) => <span key={j}>{l}<br /></span>)}</p>)}
            <p className="pt-sign"><b>{d.signer}</b><span>{d.signerRole}</span></p>
          </>
        ) : kind === "report" ? (
          <>
            <h2 className="pt-title">{d.title}</h2>
            <p className="pt-subtitle">{d.subtitle}</p>
            <p className="pt-meta">{d.date} · {d.reference} · {d.signer}</p>
            <h5>1  Summary</h5>
            {paras(d.body).map((p, i) => <p key={i}>{p}</p>)}
            <h5>2  Details</h5>
            <p>[Method, results or scope. Use short paragraphs and headings so the document scans well.]</p>
            <ul>{[0, 1, 2].map((i) => <li key={i}>[Key point]</li>)}</ul>
          </>
        ) : (
          <>
            <div className="pt-cols">
              <div><p className="pt-kicker">Bill to</p><p className="pt-addr">{lines(d.recipient).map((l, i) => <span key={i}>{l}</span>)}</p></div>
              <dl className="pt-meta-list">
                {([["Invoice no.", d.invoiceNo], ["Date", d.date], ["Due", d.dueDate], ["Reference", d.reference]] as const).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </div>
            <h4 className="pt-subject">{d.subject}</h4>
            <table className="pt-items">
              <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
              <tbody>{items.map((it, i) => <tr key={i}><td>{it.desc}</td><td>{it.qty}</td><td>{money(it.price, d.currency)}</td><td>{money(it.total, d.currency)}</td></tr>)}</tbody>
            </table>
            <dl className="pt-totals">
              <div><dt>Subtotal</dt><dd>{money(sub, d.currency)}</dd></div>
              <div><dt>VAT {rate} %</dt><dd>{money((sub * rate) / 100, d.currency)}</dd></div>
              <div className="is-total"><dt>Total due</dt><dd>{money(sub + (sub * rate) / 100, d.currency)}</dd></div>
            </dl>
            <p className="pt-kicker">Payment</p>
            <p>Please transfer the total by {d.dueDate} to {d.bank}, IBAN {d.iban}, BIC {d.bic}, quoting {d.invoiceNo}.</p>
          </>
        )}
      </main>

      <footer className="pt-foot">
        {FOOTER_COLS.filter((c) => cols[c.id]).map((c) => {
          const f = footerColumn(c.id, d);
          return <div key={c.id} data-col={c.id}><b>{f.title}</b>{f.rows.map((r, i) => <span key={i}>{r}</span>)}</div>;
        })}
        <em className="pt-foot__page">1 / 1</em>
      </footer>
    </div>
  );
}

/** Scales the 210 mm sheet to the column width. */
function Fit({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [k, setK] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setK(e.contentRect.width / 793.7)); // 210 mm @ 96 dpi
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="pt-fit" style={{ height: 1122.5 * k }}>
      <div className="pt-fit__inner" style={{ transform: `scale(${k})` }}>{children}</div>
    </div>
  );
}

export function PrintTemplateSection() {
  const [kind, setKind] = useState<PrintKind>("letter");
  const [d, setD] = useState<PrintData>({ ...PRINT_DEFAULTS, body: PRINT_BODY.letter });
  const [cols, setCols] = useState<FooterCols>(FOOTER_ALL);
  const toggleCol = (id: FooterCol) => setCols((p) => ({ ...p, [id]: !p[id] }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof PrintData>(k: K) => (e: { target: { value: string } }) => setD((p) => ({ ...p, [k]: e.target.value }));
  const choose = (k: PrintKind) => {
    setKind(k);
    setD((p) => ({ ...p, body: PRINT_BODY[k] }));
  };

  const download = async () => {
    setBusy(true);
    setErr("");
    try {
      const [{ Packer }, { buildPrintDocument }, logo] = await Promise.all([import("docx"), import("./printDocx"), wordmarkPng()]);
      const blob = await Packer.toBlob(buildPrintDocument(kind, d, logo, cols));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `bioversee-${kind}-a4.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const input = (k: keyof PrintData) => <input value={d[k]} onChange={set(k)} />;
  const area = (k: keyof PrintData, rows = 3) => <textarea rows={rows} value={d[k]} onChange={set(k)} />;

  return (
    <div className="tpl pt">
      <form className="tpl-form ds-auth-demo" onSubmit={(e) => e.preventDefault()}>
        <div className="tpl-field">
          <span className="tpl-label">Template</span>
          <SegmentedControl<PrintKind> aria-label="Print template" value={kind} onChange={choose} options={PRINT_KINDS.map((k) => ({ value: k.id, label: k.label }))} />
        </div>
        {kind === "report" ? (
          <div className="tpl-row"><Field label="Title">{input("title")}</Field><Field label="Subtitle">{input("subtitle")}</Field></div>
        ) : (
          <>
            <Field label={kind === "invoice" ? "Bill to" : "Recipient"}>{area("recipient", 4)}</Field>
            <Field label="Subject">{input("subject")}</Field>
          </>
        )}
        <div className="tpl-row"><Field label="Date">{input("date")}</Field><Field label="Reference">{input("reference")}</Field></div>
        {kind === "invoice" ? (
          <>
            <div className="tpl-row"><Field label="Invoice no.">{input("invoiceNo")}</Field><Field label="Due">{input("dueDate")}</Field></div>
            <Field label="Items · description; qty; unit price">{area("items", 3)}</Field>
            <div className="tpl-row"><Field label="VAT %">{input("vatRate")}</Field><Field label="Currency">{input("currency")}</Field></div>
          </>
        ) : (
          <>
            <Field label={kind === "report" ? "Summary" : "Body"}>{area("body", 5)}</Field>
            <div className="tpl-row"><Field label={kind === "report" ? "Author" : "Signed"}>{input("signer")}</Field>{kind === "letter" ? <Field label="Role">{input("signerRole")}</Field> : null}</div>
          </>
        )}
        <details className="pt-details">
          <summary>Company details (header &amp; footer)</summary>
          <div className="pt-grid">
            <Field label="Company">{input("company")}</Field>
            <Field label="Street">{input("street")}</Field>
            <Field label="Postcode / city">{input("city")}</Field>
            <Field label="Country">{input("country")}</Field>
            <Field label="Email">{input("email")}</Field>
            <Field label="Web">{input("web")}</Field>
            <Field label="Phone">{input("phone")}</Field>
            <Field label="Register no.">{input("regNo")}</Field>
            <Field label="VAT ID">{input("vatId")}</Field>
            <Field label="Bank">{input("bank")}</Field>
            <Field label="IBAN">{input("iban")}</Field>
            <Field label="BIC">{input("bic")}</Field>
          </div>
        </details>
        <div className="tpl-field">
          <span className="tpl-label">Footer columns</span>
          <div className="pt-toggles" role="group" aria-label="Footer columns">
            {FOOTER_COLS.map((c) => (
              <label key={c.id} className={`pt-toggle${cols[c.id] ? " is-on" : ""}`}>
                <input type="checkbox" role="switch" checked={cols[c.id]} onChange={() => toggleCol(c.id)} />
                <span className="pt-toggle__track" aria-hidden="true"><span className="pt-toggle__thumb" /></span>
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="tpl-actions landing">
          <button type="button" className="landing-btn landing-btn--primary" onClick={download} disabled={busy}>{busy ? "Building…" : "Download .docx"}</button>
          <span className="tpl-cap">A4 · Word header &amp; footer</span>
        </div>
        {err ? <p className="tpl-cap pt-err" role="alert">{err}</p> : null}
        <p className="tpl-cap">[Bracketed] values are placeholders — fill in the real company details before printing.</p>
      </form>
      <div className="tpl-preview pt-preview">
        <Fit><A4Preview kind={kind} d={d} cols={cols} /></Fit>
      </div>
    </div>
  );
}

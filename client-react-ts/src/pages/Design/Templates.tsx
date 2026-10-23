import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SegmentedControl from "../../components/SegmentedControl";
import { accentForResolvedTheme, ACCENT_PRESETS, DEFAULT_ACCENT } from "../../lib/appearance";
/** Stable public logo assets (src/public/assets/logo). Mark OR wordmark — never both. */
const WORDMARK_PNG = "/assets/logo/g-wordmark-light-480.png";
const MARK_PNG = "/assets/logo/d-mark-light-256.png";
const AVATAR_PNG = "/assets/logo/icon-192.png";
const WORDMARK_SVG = { light: "/assets/logo/g-wordmark-light.svg", dark: "/assets/logo/g-wordmark-dark.svg" };
const WORDMARK_RATIO = 433.8 / 71.7;
import { tokenBlock } from "./cssAudit";
import "./Templates.css";

/* ------------------------------------------------------------------ */
/* Brand values — read from the real stylesheets                        */
/* ------------------------------------------------------------------ */

const LIGHT = tokenBlock(":root");
const DARK = { ...LIGHT, ...tokenBlock(':root[data-theme="dark"]') };
const LANDING = tokenBlock(".landing", "src/pages/About/About.css");

/** Pick a token value, falling back only if the stylesheet could not be parsed. */
const tk = (block: Record<string, string>, name: string, fallback: string) => {
  const v = block[name];
  return v && /^#|^rgba?\(/.test(v) ? v : fallback;
};

const BRAND = {
  text: tk(LIGHT, "--bv-text", "#1d1d1f"),
  text2: tk(LIGHT, "--bv-text-secondary", "#6e6e73"),
  text3: tk(LIGHT, "--bv-text-tertiary", "#86868b"),
  surface: tk(LIGHT, "--bv-surface", "#f5f5f7"),
  card: tk(LIGHT, "--bv-card", "#ffffff"),
  line: "#e8e8ed", // --bv-line (rgba 0,0,0,.08) flattened on white for email clients
  accentHover: tk(LANDING, "--bv-accent-hover", "#0f766e"),
  cta: tk(LIGHT, "--bv-cta", "#1d1d1f"),
  darkSurface: tk(DARK, "--bv-surface", "#101012"),
  darkCard: tk(DARK, "--bv-card", "#222226"),
  darkText: tk(DARK, "--bv-text", "#e4e4e8"),
  darkText2: tk(DARK, "--bv-text-secondary", "#a0a0a8"),
  darkText3: tk(DARK, "--bv-text-tertiary", "#787880"),
};

/** Email-safe stacks: Outfit where installed, otherwise web-safe fallbacks. */
const EMAIL_DISPLAY = "Outfit, 'Segoe UI', Helvetica, Arial, sans-serif";
const EMAIL_BODY = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function hexToRgb(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Same as CSS color-mix(in srgb, a p%, b). */
function mix(a: string, b: string, p: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x * p + y * (1 - p)).toString(16).padStart(2, "0");
  return `#${c(A.r, B.r)}${c(A.g, B.g)}${c(A.b, B.b)}`;
}

function rgba(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const l = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}

/** Text colour that stays readable on an accent fill (yellow needs dark text). */
const onAccent = (accent: string) => (luminance(accent) > 0.45 ? BRAND.text : "#ffffff");
/** Accent-coloured text that stays readable on white (mirrors --bv-accent-hover = 82% + black). */
const accentInk = (accent: string) => (luminance(accent) > 0.45 ? mix(accent, "#000000", 0.55) : mix(accent, "#000000", 0.82));

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const paras = (s: string) => esc(s).split(/\n{2,}/).map((p) => p.replace(/\n/g, "<br>"));

/* ------------------------------------------------------------------ */
/* Shared UI                                                           */
/* ------------------------------------------------------------------ */

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="auth-field tpl-field">
      <span>{label}</span>
      {children}
      {hint ? <small className="tpl-hint">{hint}</small> : null}
    </label>
  );
}

function AccentPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="tpl-field">
      <span className="tpl-label">Accent</span>
      <div className="tpl-accents" role="radiogroup" aria-label="Accent">
        {ACCENT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={value === p.value}
            aria-label={p.label}
            className={`ds-accent-dot${value === p.value ? " is-active" : ""}`}
            style={{ background: p.value }}
            onClick={() => onChange(p.value)}
          />
        ))}
      </div>
    </div>
  );
}

function useFlash(): [string, (msg: string) => void] {
  const [msg, setMsg] = useState("");
  const t = useRef<number>();
  return [
    msg,
    (m: string) => {
      setMsg(m);
      window.clearTimeout(t.current);
      t.current = window.setTimeout(() => setMsg(""), 2000);
    },
  ];
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/** Copy as rich text (text/html) so it pastes formatted into Gmail / Outlook. */
async function copyRich(html: string, plain: string) {
  try {
    if (typeof ClipboardItem === "undefined") throw new Error("no ClipboardItem");
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch {
    const host = document.createElement("div");
    host.contentEditable = "true";
    host.style.cssText = "position:fixed;left:-9999px;top:0";
    host.innerHTML = html;
    document.body.appendChild(host);
    const range = document.createRange();
    range.selectNodeContents(host);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    const ok = document.execCommand("copy");
    sel?.removeAllRanges();
    host.remove();
    return ok;
  }
}

function htmlToText(html: string) {
  const d = document.createElement("div");
  d.innerHTML = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|tr|h1|h2|td)>/gi, "\n");
  return (d.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Public URL for an asset; on localhost fall back to the production domain. */
function absoluteUrl(path: string) {
  const local = /localhost|127\.0\.0\.1/.test(window.location.hostname);
  return new URL(path, local ? "https://www.bioversee.com" : window.location.origin).toString();
}

/* ------------------------------------------------------------------ */
/* 1a. Company email                                                   */
/* ------------------------------------------------------------------ */

type EmailData = {
  preheader: string;
  eyebrow: string;
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
  accent: string;
};

function buildEmailHtml(d: EmailData) {
  const accent = d.accent;
  const ink = accentInk(accent);
  const body = paras(d.body)
    .map((p) => `<p style="margin:0 0 16px;font-family:${EMAIL_BODY};font-size:16px;line-height:1.55;color:${BRAND.text2};">${p}</p>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(d.headline)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.surface};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(d.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.surface};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${BRAND.card};border:1px solid ${BRAND.line};border-radius:20px;">
<tr><td style="padding:28px 32px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><img src="${esc(d.logoUrl)}" width="160" height="26" alt="Bioversee" style="display:block;border:0;width:160px;height:26px;"></td>
</tr></table>
</td></tr>
<tr><td style="padding:28px 32px 0;background-color:${BRAND.card};">
<div style="height:4px;width:48px;background-color:${accent};border-radius:4px;font-size:0;line-height:0;">&nbsp;</div>
</td></tr>
<tr><td style="padding:20px 32px 0;">
<p style="margin:0 0 8px;font-family:${EMAIL_BODY};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${ink};">${esc(d.eyebrow)}</p>
<h1 style="margin:0 0 16px;font-family:${EMAIL_DISPLAY};font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-0.03em;color:${BRAND.text};">${esc(d.headline)}</h1>
${body}
</td></tr>
<tr><td style="padding:8px 32px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="${accent}" style="border-radius:12px;background-color:${accent};">
<a href="${esc(d.ctaUrl)}" target="_blank" style="display:inline-block;padding:13px 22px;font-family:${EMAIL_BODY};font-size:15px;font-weight:600;color:${onAccent(accent)};text-decoration:none;border-radius:12px;">${esc(d.ctaText)}</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 32px;"><div style="border-top:1px solid ${BRAND.line};font-size:0;line-height:0;">&nbsp;</div></td></tr>
<tr><td style="padding:20px 32px 28px;background-color:${BRAND.card};border-radius:0 0 20px 20px;">
<p style="margin:0;font-family:${EMAIL_BODY};font-size:14px;line-height:1.5;color:${BRAND.text};font-weight:600;">${esc(d.name)}</p>
<p style="margin:0 0 10px;font-family:${EMAIL_BODY};font-size:13px;line-height:1.5;color:${BRAND.text2};">${esc(d.role)} · Bioversee</p>
<p style="margin:0;font-family:${EMAIL_BODY};font-size:13px;line-height:1.6;color:${BRAND.text2};"><a href="mailto:${esc(d.email)}" style="color:${ink};text-decoration:none;">${esc(d.email)}</a>${d.phone ? ` &nbsp;·&nbsp; ${esc(d.phone)}` : ""}</p>
</td></tr>
</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td align="center" style="padding:20px 24px;font-family:${EMAIL_BODY};font-size:12px;line-height:1.5;color:${BRAND.text3};">
<a href="${esc(d.website)}" style="color:${BRAND.text3};text-decoration:underline;">${esc(d.website.replace(/^https?:\/\//, ""))}</a> &nbsp;·&nbsp; Industrial process control<br>
© ${new Date().getFullYear()} Bioversee
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* 1b. Email signature                                                 */
/* ------------------------------------------------------------------ */

function buildSignatureHtml(d: EmailData) {
  const ink = accentInk(d.accent);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${EMAIL_BODY};">
<tr>
<td style="vertical-align:top;padding:0 14px 0 0;border-right:2px solid ${d.accent};"><img src="${esc(absoluteUrl(MARK_PNG))}" width="48" height="48" alt="Bioversee" style="display:block;border:0;width:48px;height:48px;"></td>
<td style="vertical-align:top;padding:0 0 0 14px;">
<p style="margin:0;font-family:${EMAIL_DISPLAY};font-size:16px;font-weight:700;letter-spacing:-0.02em;color:${BRAND.text};line-height:1.3;">${esc(d.name)}</p>
<p style="margin:0 0 6px;font-size:13px;color:${BRAND.text2};line-height:1.4;">${esc(d.role)} · <span style="color:${ink};font-weight:600;">Bioversee</span></p>
<p style="margin:0;font-size:12px;color:${BRAND.text2};line-height:1.6;">
<a href="mailto:${esc(d.email)}" style="color:${BRAND.text2};text-decoration:none;">${esc(d.email)}</a>${d.phone ? `<br>${esc(d.phone)}` : ""}<br>
<a href="${esc(d.website)}" style="color:${ink};text-decoration:none;font-weight:600;">${esc(d.website.replace(/^https?:\/\//, ""))}</a>
</p>
</td>
</tr>
</table>`;
}

const DEFAULT_EMAIL: EmailData = {
  preheader: "Live monitoring and control for your bioreactor, from any browser.",
  eyebrow: "Product update",
  headline: "Control your process from the browser",
  body:
    "Hi there,\n\nPump switches and motion knobs on the left, live sensor charts on the right, and your bioreactor in the middle. Bioversee now brings monitoring and control into one view.\n\nWe believe industrial automation shouldn’t be complicated.",
  ctaText: "Open Bioversee",
  ctaUrl: "https://www.bioversee.com",
  name: "Mate Melcher",
  role: "Founder",
  email: "hello@bioversee.com",
  phone: "",
  website: "https://www.bioversee.com",
  logoUrl: "",
  accent: DEFAULT_ACCENT,
};

export function EmailTemplateSection({ initial = "email" }: { initial?: "email" | "signature" }) {
  const [d, setD] = useState<EmailData>(() => ({ ...DEFAULT_EMAIL, logoUrl: absoluteUrl(WORDMARK_PNG) }));
  const [kind, setKind] = useState<"email" | "signature">(initial);
  const [flash, setFlash] = useFlash();
  const html = useMemo(() => (kind === "email" ? buildEmailHtml(d) : buildSignatureHtml(d)), [d, kind]);
  const set = (k: keyof EmailData) => (e: { target: { value: string } }) => setD((p) => ({ ...p, [k]: e.target.value }));
  const previewDoc =
    kind === "email"
      ? html
      : `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#fff;">${html}</body></html>`;

  // Preview uses the local logo so it renders even before the PNG is deployed.
  const local = (path: string) => new URL(path, window.location.href).toString();
  const previewHtml = previewDoc
    .split(esc(absoluteUrl(WORDMARK_PNG))).join(local(WORDMARK_PNG))
    .split(esc(absoluteUrl(MARK_PNG))).join(local(MARK_PNG));

  return (
    <div className="tpl">
      <form className="tpl-form ds-auth-demo" onSubmit={(e) => e.preventDefault()}>
        <SegmentedControl<"email" | "signature">
          shape="pill"
          aria-label="Template"
          value={kind}
          onChange={setKind}
          options={[{ value: "email", label: "Email" }, { value: "signature", label: "Signature" }]}
        />
        {kind === "email" ? (
          <>
            <Field label="Eyebrow"><input value={d.eyebrow} onChange={set("eyebrow")} /></Field>
            <Field label="Headline"><input value={d.headline} onChange={set("headline")} /></Field>
            <Field label="Body" hint="Blank line = new paragraph."><textarea rows={6} value={d.body} onChange={set("body")} /></Field>
            <div className="tpl-row">
              <Field label="CTA text"><input value={d.ctaText} onChange={set("ctaText")} /></Field>
              <Field label="CTA URL"><input value={d.ctaUrl} onChange={set("ctaUrl")} /></Field>
            </div>
            <Field label="Preheader" hint="Inbox preview text."><input value={d.preheader} onChange={set("preheader")} /></Field>
          </>
        ) : null}
        <div className="tpl-row">
          <Field label="Name"><input value={d.name} onChange={set("name")} /></Field>
          <Field label="Role"><input value={d.role} onChange={set("role")} /></Field>
        </div>
        <div className="tpl-row">
          <Field label="Email"><input type="email" value={d.email} onChange={set("email")} /></Field>
          <Field label="Phone"><input value={d.phone} onChange={set("phone")} placeholder="+36 …" /></Field>
        </div>
        <Field label="Website"><input value={d.website} onChange={set("website")} /></Field>
        <Field label="Logo URL" hint="Must be a public PNG — email clients block SVG and relative paths."><input value={d.logoUrl} onChange={set("logoUrl")} /></Field>
        <AccentPicker value={d.accent} onChange={(accent) => setD((p) => ({ ...p, accent }))} />
        <div className="tpl-actions landing">
          <button type="button" className="landing-btn landing-btn--primary" onClick={async () => setFlash((await copyText(html)) ? "HTML copied" : "Copy failed")}>Copy HTML</button>
          <button type="button" className="landing-btn landing-btn--ghost" onClick={async () => setFlash((await copyRich(html, htmlToText(html))) ? "Rendered copy ready to paste" : "Copy failed")}>Copy rendered</button>
          <span className="tpl-flash" aria-live="polite">{flash}</span>
        </div>
      </form>
      <div className="tpl-preview">
        <div className="tpl-preview__bar"><span /><span /><span /><em>{kind === "email" ? d.headline : "Signature"}</em></div>
        <iframe
          title={kind === "email" ? "Email preview" : "Signature preview"}
          className={`tpl-iframe${kind === "signature" ? " tpl-iframe--sig" : ""}`}
          srcDoc={previewHtml}
          sandbox=""
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2a. LinkedIn graphics (Canvas 2D, no deps)                          */
/* ------------------------------------------------------------------ */

const SIZES = {
  square: { w: 1200, h: 1200, label: "Square 1200×1200" },
  portrait: { w: 1080, h: 1350, label: "Portrait 1080×1350" },
  landscape: { w: 1200, h: 627, label: "Link 1200×627" },
  carousel: { w: 1080, h: 1350, label: "Carousel slide 1080×1350" },
} as const;
type SizeId = keyof typeof SIZES;
type LayoutId = "announcement" | "quote" | "stat" | "event";

type PostData = {
  size: SizeId;
  layout: LayoutId;
  theme: "light" | "dark";
  accent: string;
  eyebrow: string;
  headline: string;
  subtext: string;
  stat: string;
  statLabel: string;
  author: string;
  footer: string;
  slide: number;
  slides: number;
  image: HTMLImageElement | null;
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

/** Draw wrapped text, shrinking the size until it fits maxLines. Returns height used. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  opts: { size: number; min: number; weight: number; family: string; lh: number; color: string; maxLines: number; tracking?: number; align?: CanvasTextAlign },
) {
  let size = opts.size;
  let lines: string[] = [];
  for (; size >= opts.min; size -= 2) {
    ctx.font = `${opts.weight} ${size}px ${opts.family}`;
    lines = wrap(ctx, text, maxW);
    if (lines.length <= opts.maxLines) break;
  }
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "top";
  if ("letterSpacing" in ctx && opts.tracking) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${opts.tracking * size}px`;
  lines.slice(0, opts.maxLines).forEach((l, i) => ctx.fillText(l, x, y + i * size * opts.lh));
  if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";
  return Math.min(lines.length, opts.maxLines) * size * opts.lh;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const DISPLAY = '"Outfit", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const UI = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function drawPost(ctx: CanvasRenderingContext2D, d: PostData, logo: HTMLImageElement | null) {
  const { w, h } = SIZES[d.size];
  const dark = d.theme === "dark";
  const accent = accentForResolvedTheme(d.accent, d.theme);
  const bg = dark ? BRAND.darkSurface : "#ffffff";
  const base2 = dark ? BRAND.darkCard : BRAND.surface;
  const text = dark ? BRAND.darkText : BRAND.text;
  const text2 = dark ? BRAND.darkText2 : BRAND.text2;
  const text3 = dark ? BRAND.darkText3 : BRAND.text3;
  const ink = dark ? accent : accentInk(accent);
  const u = Math.min(w, h) / 100; // layout unit
  const pad = 8 * u;
  const wide = w / h > 1.5;

  // Background: linear base + radial accent veils (mirrors .landing-hero__veil)
  const lin = ctx.createLinearGradient(0, 0, 0, h);
  lin.addColorStop(0, bg);
  lin.addColorStop(1, base2);
  ctx.fillStyle = lin;
  ctx.fillRect(0, 0, w, h);
  const veil = (cx: number, cy: number, r: number, c: string) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, c);
    g.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  veil(w * 0.5, -h * 0.08, Math.max(w, h) * 0.75, rgba(accent, dark ? 0.22 : 0.18));
  veil(w * 0.85, h * 0.7, Math.max(w, h) * 0.5, rgba(accent, dark ? 0.1 : 0.08));

  // Optional image: right half on wide, top band otherwise
  const contentX = pad;
  let contentW = w - pad * 2;
  let top = pad;
  if (d.image) {
    const img = d.image;
    const [ix, iy, iw, ih] = wide ? [w * 0.55, pad, w * 0.45 - pad, h - pad * 2] : [pad, pad + 10 * u, w - pad * 2, h * 0.36];
    ctx.save();
    roundRect(ctx, ix, iy, iw, ih, 3 * u);
    ctx.clip();
    const s = Math.max(iw / img.width, ih / img.height);
    ctx.drawImage(img, ix + (iw - img.width * s) / 2, iy + (ih - img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
    if (wide) contentW = w * 0.55 - pad * 2;
    else top = iy + ih - 4 * u;
  }

  // Brand: wordmark alone (never mark + wordmark together)
  const markS = 7 * u;
  const wordH = 4.4 * u;
  if (logo) ctx.drawImage(logo, pad, pad + (markS - wordH) / 2, wordH * WORDMARK_RATIO, wordH);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  if (d.size === "carousel") {
    ctx.font = `650 ${2.6 * u}px ${UI}`;
    ctx.fillStyle = text3;
    ctx.textAlign = "right";
    ctx.fillText(`${d.slide} / ${d.slides}`, w - pad, pad + markS / 2);
  }
  if (!d.image || wide) top = pad + markS + (wide ? 7 * u : 12 * u);
  else top += 8 * u;

  const bottom = h - pad;
  let y = top;
  const eyebrow = () => {
    if (!d.eyebrow) return;
    ctx.font = `700 ${2.6 * u}px ${UI}`;
    y += fitText(ctx, d.eyebrow.toUpperCase(), contentX, y, contentW, { size: 2.6 * u, min: 2 * u, weight: 700, family: UI, lh: 1.2, color: ink, maxLines: 1, tracking: 0.14 }) + 2.4 * u;
  };

  if (d.layout === "announcement") {
    eyebrow();
    y += fitText(ctx, d.headline, contentX, y, contentW, { size: (wide ? 8 : 9) * u, min: 5 * u, weight: 700, family: DISPLAY, lh: 1.02, color: text, maxLines: wide ? 3 : 4, tracking: -0.04 }) + 3 * u;
    y += fitText(ctx, d.subtext, contentX, y, contentW * 0.92, { size: 3.6 * u, min: 2.6 * u, weight: 400, family: UI, lh: 1.45, color: text2, maxLines: wide ? 3 : 5 });
  } else if (d.layout === "quote") {
    ctx.font = `700 ${18 * u}px ${DISPLAY}`;
    ctx.fillStyle = accent;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("“", contentX - 1 * u, y - 4 * u);
    y += 11 * u;
    y += fitText(ctx, d.headline, contentX, y, contentW, { size: (wide ? 5.6 : 6.6) * u, min: 3.6 * u, weight: 600, family: DISPLAY, lh: 1.2, color: text, maxLines: wide ? 4 : 7, tracking: -0.025 }) + 4 * u;
    ctx.fillStyle = accent;
    roundRect(ctx, contentX, y, 6 * u, 0.7 * u, 0.35 * u);
    ctx.fill();
    y += 3 * u;
    y += fitText(ctx, d.author, contentX, y, contentW, { size: 3.2 * u, min: 2.4 * u, weight: 650, family: UI, lh: 1.3, color: text, maxLines: 1 });
    fitText(ctx, d.subtext, contentX, y + 0.8 * u, contentW, { size: 2.8 * u, min: 2.2 * u, weight: 400, family: UI, lh: 1.3, color: text3, maxLines: 1 });
  } else if (d.layout === "stat") {
    eyebrow();
    y += fitText(ctx, d.stat, contentX, y, contentW, { size: (wide ? 18 : 24) * u, min: 8 * u, weight: 700, family: DISPLAY, lh: 1, color: ink, maxLines: 1, tracking: -0.05 }) + 2 * u;
    y += fitText(ctx, d.statLabel, contentX, y, contentW, { size: 4.6 * u, min: 3 * u, weight: 650, family: DISPLAY, lh: 1.15, color: text, maxLines: 2, tracking: -0.025 }) + 2.5 * u;
    y += fitText(ctx, d.subtext, contentX, y, contentW * 0.9, { size: 3.2 * u, min: 2.4 * u, weight: 400, family: UI, lh: 1.45, color: text2, maxLines: wide ? 2 : 4 });
  } else {
    // event / hiring: pill tag + headline + details card
    const tag = d.eyebrow || "We’re hiring";
    ctx.font = `700 ${2.6 * u}px ${UI}`;
    const tw = ctx.measureText(tag.toUpperCase()).width + 0.14 * 2.6 * u * tag.length + 5 * u;
    ctx.fillStyle = accent;
    roundRect(ctx, contentX, y, tw, 6 * u, 3 * u);
    ctx.fill();
    fitText(ctx, tag.toUpperCase(), contentX + 2.5 * u, y + 1.7 * u, tw, { size: 2.6 * u, min: 2 * u, weight: 700, family: UI, lh: 1, color: onAccent(accent), maxLines: 1, tracking: 0.14 });
    y += 10 * u;
    y += fitText(ctx, d.headline, contentX, y, contentW, { size: (wide ? 7 : 8) * u, min: 4.6 * u, weight: 700, family: DISPLAY, lh: 1.05, color: text, maxLines: 3, tracking: -0.04 }) + 4 * u;
    const cardH = Math.min(bottom - 10 * u - y, (wide ? 14 : 20) * u);
    if (cardH > 8 * u) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.12)";
      ctx.shadowBlur = 4 * u;
      ctx.shadowOffsetY = 1.5 * u;
      ctx.fillStyle = dark ? BRAND.darkCard : "#ffffff";
      roundRect(ctx, contentX, y, contentW, cardH, 2.4 * u);
      ctx.fill();
      ctx.restore();
      fitText(ctx, d.subtext, contentX + 3.5 * u, y + 3 * u, contentW - 7 * u, { size: 3.2 * u, min: 2.4 * u, weight: 500, family: UI, lh: 1.45, color: text2, maxLines: Math.max(1, Math.floor((cardH - 5 * u) / (3.2 * u * 1.45))) });
    }
  }

  // Footer line
  ctx.fillStyle = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  ctx.fillRect(contentX, bottom - 6 * u, (d.image && wide ? contentW : w - pad * 2), Math.max(1, 0.15 * u));
  fitText(ctx, d.footer, contentX, bottom - 4 * u, contentW, { size: 2.6 * u, min: 2 * u, weight: 550, family: UI, lh: 1.2, color: text3, maxLines: 1 });
  if (d.size === "carousel" && d.slide < d.slides) {
    ctx.font = `650 ${2.6 * u}px ${UI}`;
    ctx.fillStyle = ink;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("Swipe →", w - pad, bottom - 4 * u);
  }
}

const LAYOUT_DEFAULTS: Record<LayoutId, Partial<PostData>> = {
  announcement: { eyebrow: "Product update", headline: "Control your process from the browser", subtext: "Pump switches, motion knobs and live sensor charts — your bioreactor in one view." },
  quote: { headline: "Engineers learn, operate and keep processes safe when they can see how a plant behaves.", author: "Mate Melcher", subtext: "Founder, Bioversee" },
  stat: { eyebrow: "Live monitoring", stat: "24/7", statLabel: "process visibility from any browser", subtext: "Sensor charts update in real time — no extra hardware dashboards." },
  event: { eyebrow: "We’re hiring", headline: "Join us to make automation feel like child's play", subtext: "Frontend engineer · React + TypeScript · Remote (EU)\nApply: hello@bioversee.com" },
};

function useLogoImage(theme: "light" | "dark") {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = WORDMARK_SVG[theme];
  }, [theme]);
  return img;
}

export function LinkedInGraphicSection() {
  const [d, setD] = useState<PostData>({
    size: "square",
    layout: "announcement",
    theme: "light",
    accent: DEFAULT_ACCENT,
    eyebrow: "",
    headline: "",
    subtext: "",
    stat: "",
    statLabel: "",
    author: "",
    footer: "bioversee.com · Industrial process control",
    slide: 1,
    slides: 5,
    image: null,
    ...LAYOUT_DEFAULTS.announcement,
  });
  const logo = useLogoImage(d.theme);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const { w, h } = SIZES[d.size];

  useEffect(() => {
    void Promise.all([
      document.fonts.load(`700 40px "Outfit"`),
      document.fonts.load(`600 40px "Outfit"`),
    ]).finally(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.width = w;
    c.height = h;
    drawPost(ctx, d, logo);
  }, [d, logo, fontsReady, w, h]);

  const set = <K extends keyof PostData>(k: K, v: PostData[K]) => setD((p) => ({ ...p, [k]: v }));
  const setLayout = (layout: LayoutId) => setD((p) => ({ ...p, layout, eyebrow: "", ...LAYOUT_DEFAULTS[layout] }));

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `bioversee-linkedin-${d.layout}-${w}x${h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  };

  const onFile = (file?: File) => {
    if (!file) return set("image", null);
    const r = new FileReader();
    r.onload = () => {
      const i = new Image();
      i.onload = () => set("image", i);
      i.src = String(r.result);
    };
    r.readAsDataURL(file);
  };

  return (
    <div className="tpl">
      <form className="tpl-form ds-auth-demo" onSubmit={(e) => e.preventDefault()}>
        <Field label="Size">
          <select value={d.size} onChange={(e) => set("size", e.target.value as SizeId)}>
            {(Object.keys(SIZES) as SizeId[]).map((s) => <option key={s} value={s}>{SIZES[s].label}</option>)}
          </select>
        </Field>
        <div className="tpl-field">
          <span className="tpl-label">Layout</span>
          <SegmentedControl<LayoutId>
            aria-label="Layout"
            value={d.layout}
            onChange={setLayout}
            options={[
              { value: "announcement", label: "News" },
              { value: "quote", label: "Quote" },
              { value: "stat", label: "Stat" },
              { value: "event", label: "Event" },
            ]}
          />
        </div>
        {d.layout !== "quote" ? <Field label={d.layout === "event" ? "Tag" : "Eyebrow"}><input value={d.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} /></Field> : null}
        {d.layout === "stat" ? (
          <div className="tpl-row">
            <Field label="Stat"><input value={d.stat} onChange={(e) => set("stat", e.target.value)} /></Field>
            <Field label="Stat label"><input value={d.statLabel} onChange={(e) => set("statLabel", e.target.value)} /></Field>
          </div>
        ) : (
          <Field label={d.layout === "quote" ? "Quote" : "Headline"}><textarea rows={2} value={d.headline} onChange={(e) => set("headline", e.target.value)} /></Field>
        )}
        {d.layout === "quote" ? <Field label="Author"><input value={d.author} onChange={(e) => set("author", e.target.value)} /></Field> : null}
        <Field label={d.layout === "quote" ? "Author role" : d.layout === "event" ? "Details" : "Subtext"}><textarea rows={3} value={d.subtext} onChange={(e) => set("subtext", e.target.value)} /></Field>
        <Field label="Footer"><input value={d.footer} onChange={(e) => set("footer", e.target.value)} /></Field>
        {d.size === "carousel" ? (
          <div className="tpl-row">
            <Field label="Slide"><input type="number" min={1} max={d.slides} value={d.slide} onChange={(e) => set("slide", Math.max(1, Number(e.target.value) || 1))} /></Field>
            <Field label="of"><input type="number" min={1} max={20} value={d.slides} onChange={(e) => set("slides", Math.max(1, Number(e.target.value) || 1))} /></Field>
          </div>
        ) : null}
        <Field label="Image (optional)">
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
        </Field>
        <div className="tpl-row">
          <AccentPicker value={d.accent} onChange={(v) => set("accent", v)} />
          <div className="tpl-field">
            <span className="tpl-label">Theme</span>
            <SegmentedControl<"light" | "dark"> shape="pill" aria-label="Theme" value={d.theme} onChange={(v) => set("theme", v)} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          </div>
        </div>
        <div className="tpl-actions landing">
          <button type="button" className="landing-btn landing-btn--primary" onClick={download}>Download PNG</button>
          {d.image ? <button type="button" className="landing-btn landing-btn--ghost" onClick={() => onFile()}>Remove image</button> : null}
          <span className="tpl-cap">{w}×{h}px</span>
        </div>
      </form>
      <div className="tpl-preview tpl-preview--canvas">
        <canvas
          ref={canvasRef}
          className="tpl-canvas"
          data-testid="linkedin-canvas"
          style={{ aspectRatio: `${w} / ${h}` }}
          aria-label={`LinkedIn ${SIZES[d.size].label} preview`}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2b. LinkedIn post copy                                              */
/* ------------------------------------------------------------------ */

const LIMIT = 3000;
const FOLD = 210;

export function LinkedInCopySection() {
  const [hook, setHook] = useState("Industrial automation shouldn’t be complicated.");
  const [body, setBody] = useState(
    "We built Bioversee so makers, students and engineers can monitor and control a real bioreactor from the browser.\n\n→ Live sensor charts\n→ Pump switches and motion knobs\n→ The same lab in your pocket",
  );
  const [cta, setCta] = useState("Try it at bioversee.com — and tell us what you’d automate first.");
  const [tags, setTags] = useState("automation, bioprocess, iot, engineering");
  const [flash, setFlash] = useFlash();

  const hashtags = tags
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
    .map((t) => `#${t}`)
    .join(" ");
  const post = [hook.trim(), body.trim(), cta.trim(), hashtags].filter(Boolean).join("\n\n");
  const n = [...post].length;
  const over = n > LIMIT;
  const foldText = [...post].slice(0, FOLD).join("");
  const hookFits = [...hook.trim()].length <= FOLD;

  return (
    <div className="tpl">
      <form className="tpl-form ds-auth-demo" onSubmit={(e) => e.preventDefault()}>
        <Field label="Hook" hint={<span className={hookFits ? "" : "tpl-warn"}>{[...hook.trim()].length} / {FOLD} — keep the hook above the “see more” fold.</span>}>
          <textarea rows={2} value={hook} onChange={(e) => setHook(e.target.value)} />
        </Field>
        <Field label="Body"><textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <Field label="Call to action"><input value={cta} onChange={(e) => setCta(e.target.value)} /></Field>
        <Field label="Hashtags" hint="Comma or space separated; 3–5 works best."><input value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
        <div className="tpl-counter">
          <div className="tpl-counter__track"><span style={{ width: `${Math.min(100, (n / LIMIT) * 100)}%` }} className={over ? "is-over" : ""} /></div>
          <span className={over ? "tpl-warn" : "tpl-cap"}>{n.toLocaleString()} / {LIMIT.toLocaleString()} characters</span>
        </div>
        <div className="tpl-actions landing">
          <button type="button" className="landing-btn landing-btn--primary" disabled={over} onClick={async () => setFlash((await copyText(post)) ? "Post copied" : "Copy failed")}>Copy post</button>
          <span className="tpl-flash" aria-live="polite">{flash}</span>
        </div>
      </form>
      <div className="tpl-preview tpl-li">
        <div className="tpl-li__head">
          <img src={AVATAR_PNG} alt="" width={44} height={44} style={{ borderRadius: 10 }} />
          <div>
            <strong>Bioversee</strong>
            <span>Industrial process control · now</span>
          </div>
        </div>
        <p className="tpl-li__text">
          {foldText}
          {n > FOLD ? <span className="tpl-li__more">…see more</span> : null}
        </p>
        <details className="tpl-li__full">
          <summary>Full post</summary>
          <p className="tpl-li__text">{post}</p>
        </details>
      </div>
    </div>
  );
}

#!/usr/bin/env node
/**
 * Regenerates src/pages/Design/blueprintSheets.ts from the real logo SVGs in
 * src/components/BrandLogo/logoSvgs.ts. All geometry is parsed from those
 * strings, so the annotations always sit on the actual paths.
 *
 *   node scripts/gen-logo-blueprint.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(resolve(root, "src/components/BrandLogo/logoSvgs.ts"), "utf8");
const get = (name) => {
  const m = src.match(new RegExp(`export const ${name} = ("(?:[^"\\\\]|\\\\.)*")`));
  if (!m) throw new Error(`missing ${name}`);
  return JSON.parse(m[1]);
};
const num = (re, s) => {
  const m = s.match(re);
  if (!m) throw new Error(`no match ${re}`);
  return m.slice(1).map(Number);
};
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => String(r2(n));
const r1 = (n) => String(Math.round(n * 10) / 10);

const MARK = get("LOGO_MARK");
const SMALL = get("LOGO_MARK_SMALL");
const WORD = get("LOGO_WORDMARK");
const WORD_SMALL = get("LOGO_WORDMARK_SMALL");

/* ---------- geometry parsed from the SVGs ---------- */
function markGeo(svg) {
  const [ax, ay, R] = num(/<path d="M([\d.]+) ([\d.]+)A([\d.]+) [\d.]+ 0 1 1/, svg);
  const [W] = num(/stroke-width="([\d.]+)"/, svg);
  const [cx, cy, r, wall] = num(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="none"[^>]*stroke-width="([\d.]+)"/, svg);
  const [, ly, , bore] = num(/<path d="M([\d.]+) ([\d.]+)H[\d.]+A([\d.]+) ([\d.]+)/, svg);
  const dot = svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" style="fill/);
  return { ax, ay, R, W, cx, cy, r, wall, ly, bore, dot: dot ? dot.slice(1).map(Number) : null };
}
const G = markGeo(MARK);
const GS = markGeo(SMALL);
const [wvx, wvy, wvw, wvh] = num(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/, WORD);
const O = markGeo(WORD.slice(WORD.indexOf('"/>') + 3));
// Wordmark type metrics: cap line = top of the B stem (M7 70.5V0), x-height = top of the r/v stems.
const [stemX, baseline, cap] = num(/ZM([\d.]+) ([\d.]+)V([\d.]+)H/, WORD);
const [xh] = num(/M[\d.]+ [\d.]+V([\d.]+)H[\d.]+V[\d.]+Z/, WORD.slice(WORD.indexOf("M67.7")));
const inkRight = 431.7; // right edge of the final e (max x in the outline)
if (!WORD.includes("431.7")) throw new Error("wordmark outline changed — update inkRight");

/* ---------- drawing helpers ---------- */
const C = { bg: "#0b2f52", minor: "rgba(255,255,255,0.05)", major: "rgba(255,255,255,0.12)", frame: "rgba(255,255,255,0.45)", dim: "#ffc857", aux: "#7fd1c7", text: "#ffffff", muted: "rgba(255,255,255,0.6)" };
const FONT = 'font-family="ui-monospace, SFMono-Regular, Menlo, monospace"';
const line = (x1, y1, x2, y2, c = C.dim, w = 1, dash = "") => `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
const circle = (cx, cy, r, c = C.aux, dash = "4 4", w = 1) => `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="none" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const text = (x, y, s, { anchor = "middle", c = C.text, size = 13, weight = 500, base = "middle" } = {}) =>
  `<text x="${fmt(x)}" y="${fmt(y)}" fill="${c}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" dominant-baseline="${base}">${esc(s)}</text>`;
/** Dimension with end ticks; label centred on the line (with a background knock-out). */
function dimH(x1, x2, y, label, { c = C.dim, above = true, dy = 0 } = {}) {
  const t = 5;
  return line(x1, y, x2, y, c) + line(x1, y - t, x1, y + t, c) + line(x2, y - t, x2, y + t, c) + text((x1 + x2) / 2, y + (above ? -11 : 13) + dy, label, { c });
}
function dimV(x, y1, y2, label, { c = C.dim, side = "right" } = {}) {
  const t = 5;
  return line(x, y1, x, y2, c) + line(x - t, y1, x + t, y1, c) + line(x - t, y2, x + t, y2, c) +
    text(x + (side === "right" ? 10 : -10), (y1 + y2) / 2, label, { c, anchor: side === "right" ? "start" : "end" });
}
function grid(x, y, w, h, step, majorEvery) {
  let s = "";
  for (let i = 0, gx = x; gx <= x + w + 0.01; i++, gx += step) s += line(gx, y, gx, y + h, i % majorEvery ? C.minor : C.major);
  for (let i = 0, gy = y; gy <= y + h + 0.01; i++, gy += step) s += line(x, gy, x + w, gy, i % majorEvery ? C.minor : C.major);
  return s;
}
/** Place a logo SVG (inner markup) at x,y with a uniform scale; colours fixed for the sheet. */
function art(svg, x, y, k, colours = { text: "#e6edf5", accent: "#2bb3a6", track: "0.22" }) {
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")
    .replace(/var\(--bv-logo-track, ?[\d.]+\)/g, colours.track)
    .replace(/var\(--bv-text\)/g, colours.text)
    .replace(/var\(--bv-accent\)/g, colours.accent);
  return `<g transform="translate(${fmt(x)} ${fmt(y)}) scale(${k})" opacity="0.92">${inner}</g>`;
}
const polar = (cx, cy, R, deg) => [cx + R * Math.sin((deg * Math.PI) / 180), cy - R * Math.cos((deg * Math.PI) / 180)]; // 0° = 12 o'clock, clockwise
const sheet = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${FONT}><rect width="${w}" height="${h}" fill="${C.bg}"/>${body}</svg>`;

/* ---------- 1. Mark construction (large master + small master) ---------- */
function markPanel(svg, g, ox, oy, S, title, small) {
  const X = (u) => ox + u * S;
  const Y = (u) => oy + u * S;
  const half = g.W / 2;
  // true bounds of the ink (arc caps + vessel)
  const left = g.cx - g.R - half, right = g.cx + g.R + half, top = g.cy - g.R - half;
  const bottom = Math.max(g.ay + half, g.cy + g.r + g.wall / 2);
  let s = grid(X(0), Y(0), 64 * S, 64 * S, 4 * S, 4);
  s += `<rect x="${X(0)}" y="${Y(0)}" width="${64 * S}" height="${64 * S}" fill="none" stroke="${C.frame}"/>`;
  s += art(svg, X(0), Y(0), S);
  // construction: centre lines, R and r circles, bounding box
  s += line(X(0), Y(g.cy), X(64), Y(g.cy), C.aux, 1, "2 4") + line(X(g.cx), Y(0), X(g.cx), Y(64), C.aux, 1, "2 4");
  s += circle(X(g.cx), Y(g.cy), g.R * S) + circle(X(g.cx), Y(g.cy), g.r * S);
  s += `<rect x="${fmt(X(left))}" y="${fmt(Y(top))}" width="${fmt((right - left) * S)}" height="${fmt((bottom - top) * S)}" fill="none" stroke="${C.muted}" stroke-dasharray="6 4"/>`;
  // angle rays from C to the arc ends
  const [sx, sy] = polar(X(g.cx), Y(g.cy), g.R * S, -135);
  const [ex, ey] = polar(X(g.cx), Y(g.cy), g.R * S, small ? 135 : 45);
  s += line(X(g.cx), Y(g.cy), sx, sy, C.dim, 1) + line(X(g.cx), Y(g.cy), ex, ey, C.dim, 1);
  if (!small) {
    const [tx, ty] = polar(X(g.cx), Y(g.cy), g.R * S, 135);
    s += line(X(g.cx), Y(g.cy), tx, ty, C.dim, 1, "3 3");
    s += text(tx + 14, ty + 18, "+135°", { c: C.dim, anchor: "start" });
  }
  s += `<circle cx="${fmt(X(g.cx))}" cy="${fmt(Y(g.cy))}" r="3" fill="${C.dim}"/>`;
  s += text(sx - 12, sy + 18, "−135°", { c: C.dim, anchor: "end" });
  s += text(ex + (small ? 14 : 0), ey + (small ? 16 : -30), small ? "+135°" : "+45°", { c: C.dim, anchor: "start" });
  // R label along the ray (midpoint, offset)
  // R: vertical radius to 12 o'clock, labelled inside the empty upper bore
  s += line(X(g.cx), Y(g.cy), X(g.cx), Y(g.cy - g.R), C.dim, 1.25);
  s += text(X(g.cx) + 8, Y(g.cy - g.bore * 0.55), `R ${fmt(g.R)}`, { c: C.dim, anchor: "start" });
  // chain dimension across the left half on the centre line, drawn above the artboard
  const yChain = Y(0) - 22;
  const stops = [left, g.cx - g.R + half, g.cx - g.r - g.wall / 2, g.cx - g.r + g.wall / 2, g.cx + (g.r - g.wall / 2)];
  const labels = [`W ${fmt(g.W)}`, `gap ${fmt(stops[2] - stops[1])}`, `wall ${fmt(g.wall)}`, `Ø ${fmt(stops[4] - stops[3])}`];
  stops.forEach((u) => (s += line(X(u), yChain - 5, X(u), Y(g.cy), "rgba(255,200,87,0.28)", 1, "2 3")));
  for (let i = 0; i < 4; i++) s += dimH(X(stops[i]), X(stops[i + 1]), yChain, labels[i], { dy: i % 2 ? -16 : 0 });
  // bounding box dimensions
  s += dimH(X(left), X(right), Y(64) + 24, `${r1(right - left)} u`, { above: false });
  s += dimV(X(64) + 22, Y(top), Y(bottom), `${r1(bottom - top)} u`);
  // liquid offset from C (large master only — the small master fills to C)
  const lOff = g.ly - g.cy;
  s += line(X(0) - 6, Y(g.ly), X(g.cx - g.bore), Y(g.ly), C.aux, 1, "2 3");
  s += text(X(0) - 12, Y(g.ly), lOff ? `liquid C+${fmt(lOff)}` : "liquid = C", { c: C.aux, anchor: "end", size: 12 });
  if (g.dot) s += text(X(g.dot[0]) + 30, Y(g.dot[1]) + 4, `dot Ø ${fmt(g.dot[2] * 2)}`, { c: C.dim, anchor: "start" });
  s += text(X(0), Y(64) + 62, title, { anchor: "start", size: 15, weight: 700 });
  return s;
}
const S = 6;
const BLUEPRINT_MARK = sheet(1200, 590,
  markPanel(MARK, G, 120, 92, S, "Mark · ≥ 48 px", false) +
  markPanel(SMALL, GS, 710, 92, S, "Small mark · < 48 px", true) +
  text(1180, 570, "u = 1/64 artboard · 8 px @ 512", { anchor: "end", c: C.muted, size: 12 }));

/* ---------- 2. Wordmark construction ---------- */
function wordPanel(svg, ox, oy, k, title, small) {
  const X = (u) => ox + (u - wvx) * k;
  const Y = (u) => oy + (u - wvy) * k;
  let s = "";
  const x0 = X(wvx) - 10, x1 = X(wvx + wvw) + 10;
  const guide = (u, label, c) => line(x0, Y(u), x1, Y(u), c, 1, "5 4") + text(x1 + 10, Y(u), label, { c, anchor: "start" });
  s += art(svg, X(wvx), Y(wvy), k);
  s += guide(cap, "cap", C.muted) + guide(xh, "x-height", C.aux) + guide(baseline, "baseline", C.dim);
  // o construction
  const outer = O.R + O.W / 2;
  s += circle(X(O.cx), Y(O.cy), outer * k, C.dim, "4 4");
  s += line(X(O.cx), Y(O.cy - outer) - 14, X(O.cx), Y(O.cy + outer) + 14, C.dim, 1, "2 3");
  s += line(X(O.cx) - 8, Y(O.cy), X(O.cx) + 8, Y(O.cy), C.dim) ;
  if (!small) {
    s += dimV(X(stemX) - 56, Y(cap), Y(baseline), `cap ${fmt(baseline - cap)}`, { side: "left" });
    s += dimV(X(stemX) - 22, Y(xh), Y(baseline), `x ${fmt(baseline - xh)}`, { c: C.aux, side: "left" });
    s += text(X(O.cx), Y(baseline) + 62, `ring ${fmt(O.W)} · gap ${fmt(O.R - O.W / 2 - O.r - O.wall / 2)} · wall ${fmt(O.wall)}`, { c: C.dim, size: 12 });
    s += dimH(X(O.cx - outer), X(O.cx + outer), Y(baseline) + 34, `o Ø ${fmt(outer * 2)}`, { above: false });
    s += dimH(X(stemX), X(inkRight), Y(baseline) + 96, `${fmt(inkRight - stemX)}`, { above: false, c: C.muted });
    s += text(X(O.cx), Y(cap) - 22, `centre ${fmt(O.cy)} = x-height middle`, { c: C.dim, size: 12 });
  } else {
    s += text(X(O.cx), Y(cap) - 22, "o = small mark · same Ø and centre", { c: C.dim, size: 12 });
  }
  s += text(X(wvx), Y(wvy + wvh) + (small ? 30 : 150), title, { anchor: "start", size: 15, weight: 700 });
  return s;
}
const BLUEPRINT_WORD = sheet(1160, 420,
  wordPanel(WORD, 150, 60, 2, "Wordmark · ≥ 160 px wide · units per 100 em", false));
const BLUEPRINT_WORD_SMALL = sheet(1160, 230,
  wordPanel(WORD_SMALL, 150, 60, 1.4, "Small wordmark · < 160 px wide", true));

/* ---------- 3. Clear space (measured from the ink bounds) ---------- */
function clearPanel(svg, vb, ink, ox, oy, k, x, label) {
  // vb/ink = [x, y, w, h] in the logo's own units; ox/oy = sheet position of the ink box
  const X = (u) => ox + (u - ink[0]) * k;
  const Y = (u) => oy + (u - ink[1]) * k;
  const pad = x * k, w = ink[2] * k, h = ink[3] * k;
  let s = `<rect x="${fmt(ox - pad)}" y="${fmt(oy - pad)}" width="${fmt(w + 2 * pad)}" height="${fmt(h + 2 * pad)}" fill="rgba(43,179,166,0.12)" stroke="${C.aux}" stroke-dasharray="5 4"/>`;
  s += `<rect x="${fmt(ox)}" y="${fmt(oy)}" width="${fmt(w)}" height="${fmt(h)}" fill="${C.bg}" stroke="${C.muted}" stroke-width="0.75" stroke-dasharray="2 3"/>`;
  s += art(svg, X(vb[0]), Y(vb[1]), k);
  s += dimH(ox - pad, ox, oy + h / 2, label);
  s += dimV(ox + w / 2, oy - pad, oy, label, { side: "right" });
  return s;
}
const markInk = [G.cx - G.R - G.W / 2, G.cy - G.R - G.W / 2, 2 * G.R + G.W, Math.max(G.ay + G.W / 2, G.cy + G.r + G.wall / 2) - (G.cy - G.R - G.W / 2)];
const wordInk = [stemX, -1.1, inkRight - stemX, 71.7 + 1.1]; // i-dot top / s overshoot bottom
if (!WORD.includes("-1.1") || !WORD.includes("71.7")) throw new Error("wordmark outline changed — update wordInk");
const markX = G.R; // x = ring radius
const wordX = baseline - cap; // x = cap height
const km = 3.2, kw = 1.0;
const BLUEPRINT_CLEAR = sheet(1160, 330,
  clearPanel(MARK, [0, 0, 64, 64], markInk, 60 + markX / 2 * km, 50 + markX / 2 * km, km, markX / 2, "0.5x") +
  text(60, 50 + (markInk[3] + markX) * km + 30, `Mark · 0.5x  (x = R = ${fmt(G.R)} u)`, { anchor: "start", size: 14, weight: 700 }) +
  clearPanel(WORD, [wvx, wvy, wvw, wvh], wordInk, 440 + wordX * kw, 60 + wordX * kw, kw, wordX, "x") +
  text(440, 60 + (wordInk[3] + 2 * wordX) * kw + 30, `Wordmark · 1x  (x = cap height ${fmt(wordX)})`, { anchor: "start", size: 14, weight: 700 }));

const out = `// Generated by scripts/gen-logo-blueprint.mjs from src/components/BrandLogo/logoSvgs.ts — do not edit by hand.
export const BLUEPRINT_MARK = ${JSON.stringify(BLUEPRINT_MARK)};
export const BLUEPRINT_WORD = ${JSON.stringify(BLUEPRINT_WORD)};
export const BLUEPRINT_WORD_SMALL = ${JSON.stringify(BLUEPRINT_WORD_SMALL)};
export const BLUEPRINT_CLEAR = ${JSON.stringify(BLUEPRINT_CLEAR)};
/** Measured values (mark units u = 1/64 artboard; wordmark units per 100 em). */
export const BLUEPRINT_GEO = ${JSON.stringify({ mark: G, small: GS, o: O, word: { cap, xh, baseline, width: r2(inkRight - stemX) } })} as const;
`;
writeFileSync(resolve(root, "src/pages/Design/blueprintSheets.ts"), out);
console.log("wrote blueprintSheets.ts", { G, GS, O, cap, xh, baseline });

import type { CSSProperties, ReactNode } from "react";
import { LogoAssetGallery } from "./LogoAssets";
import { BLUEPRINT_MARK, BLUEPRINT_WORD } from "./logoBlueprint";
import { LOGO_MARK, LOGO_MARK_SMALL, LOGO_TILE, LOGO_WORDMARK, LOGO_WORDMARK_SMALL, WORDMARK_RATIO } from "../../components/BrandLogo/logoSvgs";

/** Inline SVG from the generated geometry module (trusted, build-time strings). */
function Svg({ src, className, style, label }: { src: string; className?: string; style?: CSSProperties; label: string }) {
  return <span role="img" aria-label={label} className={`lb-svg ${className ?? ""}`} style={style} dangerouslySetInnerHTML={{ __html: src }} />;
}

function Block({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="ds-sub">
      <h3 className="ds-sub__title">{title}</h3>
      {note ? <p className="ds-note">{note}</p> : null}
      {children}
    </div>
  );
}

const SPECS: [string, string, string][] = [
  ["Base unit u", "1/64 of the mark artboard", "8px @ 512"],
  ["Centre C", "(32, 34)u — shared by ring, sweep, dot, vessel", "(256, 272)px"],
  ["Ring centreline R", "24u", "192px"],
  ["Stroke W (ring, sweep, vessel wall)", "6u · round caps", "48px"],
  ["Track arc", "−135° → +135° (270°, open at bottom)", "—"],
  ["Teal sweep", "−135° → +45° (180°)", "—"],
  ["Setpoint dot", "Ø 7.5u = 1.25W, centred on R at +45°", "Ø 60px"],
  ["Vessel centreline r", "14u", "112px"],
  ["Ring ↔ vessel gap", "4u, constant all round", "32px"],
  ["Vessel bore r", "11u", "88px"],
  ["Liquid surface", "1.5u below C → depth 9.5u", "12px / 76px"],
  ["Bounding box", "54 × 47u (x 5→59, y 7→54)", "432 × 376px"],
  ["Optical centring", "C sits 2u below the artboard centre", "16px"],
  ["Small master (≤ 48px)", "R 24 · W 8 · wall 5 · gap 4u · C (32, 32) · no track, no dot", "2px / 1px @ 16"],
];

const WORD_SPECS: [string, string][] = [
  ["Typeface", "Outfit, weight 650, converted to outlines"],
  ["Cap height / x-height", "70.5 / 48.5 per 100 em"],
  ["Letterspacing", "−0.015 em, applied evenly after the font’s own kerning"],
  ["Mark-‘o’", "The D mark replaces the ‘o’: real o advance and side-bearings; Ø 51.5 incl. overshoot, centred on the x-height middle"],
  ["Mark-‘o’ angles", "Same as the mark: sweep −135° → +45°, dot Ø 1.25 × ring stroke"],
  ["Mark-‘o’ (per 100 em)", "Ring 8 · gap 3 · vessel wall 6 · bore r 8.75 · liquid 1.2 below centre — combined weight ≈ the o stem (13.8)"],
  ["Small wordmark (< 160px wide)", "The 'o' is the small mark (favicon master): 270° teal arc, vessel ring, liquid — no track, no dot. Same outer size and centre as the large 'o'"],
];

const COLOURS: [string, string, string, string][] = [
  ["Ink (wordmark, dot, vessel)", "--bv-text", "#1d1d1f", "#e4e4e8"],
  ["Accent (sweep, liquid)", "--bv-accent", "#0d9488", "#69bdb5"],
  ["Track", "--bv-text @ opacity", "20%", "30%"],
  ["App tile · ground", "fixed", "#0d9488", "same"],
  ["App tile · arc + vessel wall", "fixed", "#ffffff", "same"],
  ["App tile · dot + liquid (no track)", "fixed", "#1d1d1f", "same"],
  ["Monochrome", "fixed", "#000000", "#ffffff"],
];

const DONTS: { label: string; style: CSSProperties; bg?: string; combo?: boolean }[] = [
  { label: "Don’t combine mark + wordmark", style: {}, combo: true },
  { label: "Don’t stretch or squash", style: { transform: "scaleX(1.45)" } },
  { label: "Don’t rotate the dial", style: { transform: "rotate(35deg)" } },
  { label: "Don’t recolour the parts", style: { filter: "hue-rotate(150deg) saturate(2)" } },
  { label: "Don’t add effects or shadows", style: { filter: "drop-shadow(4px 6px 0 rgba(0,0,0,.35)) blur(.4px)" } },
  { label: "Don’t place on busy imagery", style: {}, bg: "repeating-linear-gradient(45deg,#f59e0b 0 10px,#0ea5e9 10px 20px)" },
  { label: "Don’t use the large master below 48px", style: { width: 18, height: 18 } },
];


export function LogoBlueprintSection() {
  return (
    <>
      <Block title="Mark construction · Dial + vessel" note="All dimensions in mark units (u = 1/64 of the artboard) and px at 512.">
        <div className="lb-sheet"><Svg src={BLUEPRINT_MARK} label="Technical construction drawing of the dial-and-vessel mark" /></div>
        <div className="lb-table-wrap">
          <table className="lb-table">
            <thead><tr><th>Element</th><th>Units</th><th>@ 512px</th></tr></thead>
            <tbody>{SPECS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
          </table>
        </div>
      </Block>

      <Block title="Wordmark construction · mark as ‘o’" note="Measurements per 100 em (font size 100).">
        <div className="lb-sheet"><Svg src={BLUEPRINT_WORD} label="Wordmark construction with baseline, x-height and cap-height" /></div>
        <div className="lb-table-wrap">
          <table className="lb-table">
            <tbody>{WORD_SPECS.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody>
          </table>
        </div>
      </Block>

      <Block title="Mark or wordmark — never both" note="Rendered from the tokens, so they follow the theme toggle.">
        <div className="lb-grid">
          <div className="lb-stage"><Svg src={LOGO_MARK} label="Mark" style={{ height: 120, width: 120 }} /><span className="ds-cap">Mark</span></div>
          <div className="lb-stage lb-stage--wide"><Svg src={LOGO_WORDMARK} label="Wordmark" style={{ height: 52, width: 52 * WORDMARK_RATIO }} /><span className="ds-cap">Wordmark</span></div>
          <div className="lb-stage lb-row">
            {[48, 32, 16].map((s) => <Svg key={s} src={LOGO_MARK_SMALL} label={`Small mark ${s}px`} style={{ width: s, height: s }} />)}
            <span className="ds-cap">Small mark · 48 / 32 / 16px</span>
          </div>
          <div className="lb-stage lb-row">
            {[150, 120, 90].map((w) => <Svg key={w} src={LOGO_WORDMARK_SMALL} label={`Small wordmark ${w}px`} style={{ width: w, height: w / WORDMARK_RATIO }} />)}
            <span className="ds-cap">Small wordmark · 150 / 120 / 90px</span>
          </div>
          <div className="lb-stage"><Svg src={LOGO_TILE} label="App icon tile" style={{ height: 96, width: 96, borderRadius: 22, overflow: "hidden" }} /><span className="ds-cap">App-icon tile</span></div>
        </div>
      </Block>

      <Block title="Clear space & minimum size" note="x = cap height of ‘B’ (= the mark’s ring diameter ÷ 2 for the mark). Keep ≥ 0.5x around the mark and ≥ 1x around the wordmark.">
        <div className="lb-grid">
          <div className="lb-stage"><span className="lb-clear lb-clear--half"><Svg src={LOGO_MARK} label="Mark with clear space" style={{ height: 72, width: 72 }} /></span><span className="ds-cap">Mark · 0.5x</span></div>
          <div className="lb-stage"><span className="lb-clear"><Svg src={LOGO_WORDMARK} label="Wordmark with clear space" style={{ height: 34, width: 34 * WORDMARK_RATIO }} /></span><span className="ds-cap">Wordmark · 1x</span></div>
          <div className="lb-stage lb-mins">
            <span><b>Mark</b> 16px (small master below 48px)</span>
            <span><b>Wordmark</b> 72px wide (small variant below 160px)</span>
            <span><b>Favicon</b> small mark · <b>App icon</b> teal tile</span>
          </div>
        </div>
      </Block>

      <Block title="Colour specification">
        <div className="lb-table-wrap">
          <table className="lb-table">
            <thead><tr><th>Part</th><th>Token</th><th>Light</th><th>Dark</th></tr></thead>
            <tbody>{COLOURS.map(([a, b, c, d]) => (
              <tr key={a}><td>{a}</td><td><code className="ds-code">{b}</code></td>
                <td>{c.startsWith("#") ? <span className="lb-chip" style={{ background: c.split(" ")[0] }} /> : null}{c}</td>
                <td>{d.startsWith("#") ? <span className="lb-chip" style={{ background: d }} /> : null}{d}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Block>

      <Block title="Do / don’t">
        <div className="lb-grid lb-grid--dd">
          <div className="lb-stage lb-do"><Svg src={LOGO_WORDMARK} label="Correct" style={{ height: 30, width: 30 * WORDMARK_RATIO }} /><span className="ds-cap">Do · wordmark alone where there is room</span></div>
          <div className="lb-stage lb-do lb-stage--teal"><Svg src={LOGO_TILE} label="Correct on tile" style={{ height: 72, width: 72, borderRadius: 16, overflow: "hidden" }} /><span className="ds-cap">Do · use the tile on colour</span></div>
          {DONTS.map((d) => (
            <div key={d.label} className="lb-stage lb-dont" style={d.bg ? { background: d.bg } : undefined}>
              {d.combo ? (
                <span className="lb-combo">
                  <Svg src={LOGO_MARK} label={d.label} style={{ height: 40, width: 40 }} />
                  <Svg src={LOGO_WORDMARK} label="" style={{ height: 22, width: 22 * WORDMARK_RATIO }} />
                </span>
              ) : (
                <Svg src={LOGO_MARK} label={d.label} style={{ height: 72, width: 72, ...d.style }} />
              )}
              <span className="ds-cap">{d.label}</span>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Logo assets" note="Pick a variant, then download it as SVG, PNG or JPG.">
        <LogoAssetGallery />
      </Block>
    </>
  );
}

import type { CSSProperties, ReactNode } from "react";
import { LogoAssetGallery } from "./LogoAssets";
import { BLUEPRINT_CLEAR, BLUEPRINT_MARK, BLUEPRINT_WORD, BLUEPRINT_WORD_SMALL } from "./blueprintSheets";
import { LOGO_MARK, LOGO_TILE, LOGO_WORDMARK, WORDMARK_RATIO } from "../../components/BrandLogo/logoSvgs";

/**
 * Logo blueprint. The drawings are generated from the real logo SVGs by
 * scripts/gen-logo-blueprint.mjs — re-run it after changing logoSvgs.ts.
 */

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

function downloadSvg(svg: string, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  a.download = `${name}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Sheet({ src, label, file }: { src: string; label: string; file: string }) {
  return (
    <figure className="lb-figure">
      <div className="lb-sheet"><Svg src={src} label={label} /></div>
      <figcaption className="lb-figcap">
        <button type="button" className="lb-dl" onClick={() => downloadSvg(src, file)}>SVG ↓</button>
      </figcaption>
    </figure>
  );
}

const COLOURS: [string, string, string, string][] = [
  ["Ink · wordmark, dot, vessel", "--bv-text", "#1d1d1f", "#e4e4e8"],
  ["Accent · sweep, liquid", "--bv-accent", "#0d9488", "#69bdb5"],
  ["Track", "--bv-text", "20 %", "30 %"],
  ["App tile", "fixed", "#0d9488", "#0d9488"],
  ["Mono", "fixed", "#000000", "#ffffff"],
];

const DONTS: { label: string; style: CSSProperties; bg?: string; combo?: boolean }[] = [
  { label: "Mark + wordmark", style: {}, combo: true },
  { label: "Stretched", style: { transform: "scaleX(1.45)" } },
  { label: "Rotated", style: { transform: "rotate(35deg)" } },
  { label: "Recoloured", style: { filter: "hue-rotate(150deg) saturate(2)" } },
  { label: "Effects", style: { filter: "drop-shadow(4px 6px 0 rgba(0,0,0,.35)) blur(.4px)" } },
  { label: "Busy background", style: {}, bg: "repeating-linear-gradient(45deg,#f59e0b 0 10px,#0ea5e9 10px 20px)" },
];

const chip = (v: string) => (v.startsWith("#") ? <span className="lb-chip" style={{ background: v }} /> : null);

export function LogoBlueprintSection() {
  return (
    <>
      <Block title="Mark" note="u = 1/64 of the artboard. Large master from 48 px, small master below.">
        <Sheet src={BLUEPRINT_MARK} label="Mark construction: grid, radii, stroke widths and arc angles" file="bioversee-blueprint-mark" />
      </Block>

      <Block title="Wordmark" note="Outfit 650, outlined. The ‘o’ is the mark; below 160 px wide it is the small mark.">
        <Sheet src={BLUEPRINT_WORD} label="Wordmark construction: cap height, x-height, baseline and the mark-o" file="bioversee-blueprint-wordmark" />
        <Sheet src={BLUEPRINT_WORD_SMALL} label="Small wordmark construction" file="bioversee-blueprint-wordmark-small" />
      </Block>

      <Block title="Clear space & minimum size">
        <Sheet src={BLUEPRINT_CLEAR} label="Clear space around the mark and the wordmark" file="bioversee-blueprint-clear-space" />
        <div className="lb-mins">
          <span><b>Mark</b> ≥ 16 px</span>
          <span><b>Wordmark</b> ≥ 72 px wide</span>
          <span><b>Favicon</b> small mark</span>
          <span><b>App icon</b> teal tile</span>
        </div>
      </Block>

      <Block title="Colour">
        <div className="lb-table-wrap">
          <table className="lb-table">
            <thead><tr><th>Part</th><th>Token</th><th>Light</th><th>Dark</th></tr></thead>
            <tbody>{COLOURS.map(([a, b, c, d]) => (
              <tr key={a}><td>{a}</td><td><code className="ds-code">{b}</code></td><td>{chip(c)}{c}</td><td>{chip(d)}{d}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Block>

      <Block title="Usage">
        <div className="lb-grid lb-grid--dd">
          <div className="lb-stage lb-do"><Svg src={LOGO_WORDMARK} label="Correct: wordmark alone" style={{ height: 30, width: 30 * WORDMARK_RATIO }} /><span className="ds-cap">Wordmark alone</span></div>
          <div className="lb-stage lb-do"><Svg src={LOGO_MARK} label="Correct: mark alone" style={{ height: 72, width: 72 }} /><span className="ds-cap">Mark alone</span></div>
          <div className="lb-stage lb-do lb-stage--teal"><Svg src={LOGO_TILE} label="Correct: tile on colour" style={{ height: 72, width: 72, borderRadius: 16, overflow: "hidden" }} /><span className="ds-cap">Tile on colour</span></div>
          {DONTS.map((d) => (
            <div key={d.label} className="lb-stage lb-dont" style={d.bg ? { background: d.bg } : undefined}>
              {d.combo ? (
                <span className="lb-combo">
                  <Svg src={LOGO_MARK} label={`Incorrect: ${d.label}`} style={{ height: 40, width: 40 }} />
                  <Svg src={LOGO_WORDMARK} label="" style={{ height: 22, width: 22 * WORDMARK_RATIO }} />
                </span>
              ) : (
                <Svg src={LOGO_MARK} label={`Incorrect: ${d.label}`} style={{ height: 72, width: 72, ...d.style }} />
              )}
              <span className="ds-cap">{d.label}</span>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Downloads" note="SVG, PNG or JPG.">
        <LogoAssetGallery />
      </Block>
    </>
  );
}

import { useState } from "react";

/** Downloadable logo assets — previews, usage notes and SVG / PNG / JPG export (canvas, no deps). */

const DARK_BG = "#101012"; // --bv-surface (dark)
const LIGHT_BG = "#ffffff";
const TILE_BG = "#0d9488";

type Asset = {
  file: string; // in /assets/logo
  slug: string; // download base name
  name: string;
  use: string;
  min: string;
  bg: "light" | "dark" | "tile";
  defaultSize?: number;
};

type Group = { title: string; note: string; assets: Asset[] };

const GROUPS: Group[] = [
  {
    title: "Mark",
    note: "Dial + vessel symbol, 48px and up. Never place it next to the wordmark.",
    assets: [
      { file: "d-mark-light.svg", slug: "bioversee-mark-light", name: "Mark · Light background", use: "Default mark on white or light surfaces.", min: "48px", bg: "light" },
      { file: "d-mark-dark.svg", slug: "bioversee-mark-dark", name: "Mark · Dark background", use: "Dark mode and dark photos.", min: "48px", bg: "dark" },
      { file: "d-mark-mono-black.svg", slug: "bioversee-mark-black", name: "Mark · Black (mono)", use: "One-colour print, stamps, engraving.", min: "48px", bg: "light" },
      { file: "d-mark-mono-white.svg", slug: "bioversee-mark-white", name: "Mark · White (mono)", use: "One-colour on dark or coloured backgrounds.", min: "48px", bg: "dark" },
    ],
  },
  {
    title: "Mark – small (≤48px)",
    note: "Simplified master: heavier ring, no track, no dot. Use from 16 to 48px.",
    assets: [
      { file: "d-mark-small-light.svg", slug: "bioversee-mark-small-light", name: "Small mark · Light background", use: "Tabs, avatars, list icons on light UI.", min: "16px", bg: "light", defaultSize: 512 },
      { file: "d-mark-small-dark.svg", slug: "bioversee-mark-small-dark", name: "Small mark · Dark background", use: "Small icons in dark mode.", min: "16px", bg: "dark", defaultSize: 512 },
      { file: "d-mark-small-mono-black.svg", slug: "bioversee-mark-small-black", name: "Small mark · Black (mono)", use: "Tiny one-colour marks on light.", min: "16px", bg: "light", defaultSize: 512 },
      { file: "d-mark-small-mono-white.svg", slug: "bioversee-mark-small-white", name: "Small mark · White (mono)", use: "Tiny one-colour marks on dark.", min: "16px", bg: "dark", defaultSize: 512 },
    ],
  },
  {
    title: "Wordmark",
    note: "“Bioversee” with the mark as the ‘o’. Use wherever there is horizontal room, 160px wide and up.",
    assets: [
      { file: "g-wordmark-light.svg", slug: "bioversee-wordmark-light", name: "Wordmark · Light background", use: "Headers, documents, slides on light.", min: "160px wide", bg: "light" },
      { file: "g-wordmark-dark.svg", slug: "bioversee-wordmark-dark", name: "Wordmark · Dark background", use: "Dark mode, dark slides and video.", min: "160px wide", bg: "dark" },
      { file: "g-wordmark-mono-black.svg", slug: "bioversee-wordmark-black", name: "Wordmark · Black (mono)", use: "One-colour print on light.", min: "160px wide", bg: "light" },
      { file: "g-wordmark-mono-white.svg", slug: "bioversee-wordmark-white", name: "Wordmark · White (mono)", use: "One-colour on dark or teal.", min: "160px wide", bg: "dark" },
    ],
  },
  {
    title: "Wordmark – small (<160px)",
    note: "Solid vessel with a teal lower half so the ‘o’ stays clean. 72–160px wide.",
    assets: [
      { file: "g-wordmark-small-light.svg", slug: "bioversee-wordmark-small-light", name: "Small wordmark · Light background", use: "Navbars, auth cards, email footers.", min: "72px wide", bg: "light", defaultSize: 512 },
      { file: "g-wordmark-small-dark.svg", slug: "bioversee-wordmark-small-dark", name: "Small wordmark · Dark background", use: "Compact headers in dark mode.", min: "72px wide", bg: "dark", defaultSize: 512 },
    ],
  },
  {
    title: "App icon tile",
    note: "Teal tile, white arc + vessel, ink dot + liquid.",
    assets: [
      { file: "d-app-tile.svg", slug: "bioversee-app-tile", name: "App tile · Rounded", use: "Presentations, social avatars, store listings.", min: "48px", bg: "light" },
      { file: "d-icon-square.svg", slug: "bioversee-app-icon-square", name: "App icon · Square (full-bleed)", use: "iOS / Android / PWA icons (the OS rounds the corners).", min: "48px", bg: "tile" },
      { file: "d-app-tile-small.svg", slug: "bioversee-app-tile-small", name: "App tile · Small", use: "Tile under 48px (favicon-size tiles).", min: "16px", bg: "light", defaultSize: 512 },
    ],
  },
  {
    title: "Favicons",
    note: "Already wired in src/index.html and site.webmanifest; here for reuse.",
    assets: [
      { file: "favicon.svg", slug: "bioversee-favicon", name: "Favicon · Adaptive SVG", use: "Browser tab; switches colours with the system theme.", min: "16px", bg: "light", defaultSize: 32 },
      { file: "d-icon-square.svg", slug: "bioversee-apple-touch-icon", name: "Apple touch icon", use: "iOS home-screen bookmark (180px).", min: "180px", bg: "tile", defaultSize: 180 },
      { file: "d-icon-square.svg", slug: "bioversee-manifest-icon", name: "Manifest icon", use: "PWA / Android install icon (192 and 512px).", min: "192px", bg: "tile", defaultSize: 512 },
    ],
  },
];

const SIZES = [16, 32, 48, 180, 192, 256, 512, 1024, 2048];
const bgColor = (bg: Asset["bg"]) => (bg === "dark" ? DARK_BG : bg === "tile" ? TILE_BG : LIGHT_BG);

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Render the SVG to canvas at `size` px on its long edge; JPG gets a solid background. */
async function rasterize(asset: Asset, size: number, type: "png" | "jpg"): Promise<Blob> {
  const text = await (await fetch(`/assets/logo/${asset.file}`)).text();
  const vb = /viewBox="([^"]+)"/.exec(text)?.[1].split(/\s+/).map(Number) ?? [0, 0, 64, 64];
  const ratio = vb[2] / vb[3];
  const w = ratio >= 1 ? size : Math.round(size * ratio);
  const h = ratio >= 1 ? Math.round(size / ratio) : size;
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  if (type === "jpg") {
    ctx.fillStyle = bgColor(asset.bg);
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), type === "jpg" ? "image/jpeg" : "image/png", 0.95),
  );
}

function AssetCard({ asset }: { asset: Asset }) {
  const [size, setSize] = useState(asset.defaultSize ?? 1024);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (type: "png" | "jpg") => {
    setBusy(type);
    try {
      save(await rasterize(asset, size, type), `${asset.slug}-${size}.${type}`);
    } finally {
      setBusy(null);
    }
  };
  const downloadSvg = async () => {
    const blob = await (await fetch(`/assets/logo/${asset.file}`)).blob();
    save(new Blob([blob], { type: "image/svg+xml" }), `${asset.slug}.svg`);
  };
  return (
    <article className="la-card" data-asset={asset.slug}>
      <div className={`la-preview la-preview--${asset.bg}`}>
        <img src={`/assets/logo/${asset.file}`} alt={asset.name} />
      </div>
      <div className="la-body">
        <h4 className="la-name">{asset.name}</h4>
        <p className="la-use">{asset.use}</p>
        <p className="la-min">Min size · {asset.min}</p>
        <div className="la-actions">
          <button type="button" className="la-btn" onClick={downloadSvg}>SVG</button>
          <button type="button" className="la-btn" disabled={busy !== null} onClick={() => run("png")}>{busy === "png" ? "…" : "PNG"}</button>
          <button type="button" className="la-btn" disabled={busy !== null} onClick={() => run("jpg")}>{busy === "jpg" ? "…" : "JPG"}</button>
          <label className="la-size">
            <span className="la-size__label">Size</span>
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label={`${asset.name} export size`}>
              {SIZES.map((s) => <option key={s} value={s}>{s}px</option>)}
            </select>
          </label>
        </div>
      </div>
    </article>
  );
}

export function LogoAssetGallery() {
  return (
    <div className="la">
      <p className="ds-note">PNG keeps transparency. JPG is flattened on white (light variants), #101012 (dark variants) or teal (square icon). Size = long edge in px.</p>
      {GROUPS.map((g) => (
        <section key={g.title} className="la-group">
          <h4 className="la-group__title">{g.title}</h4>
          <p className="la-group__note">{g.note}</p>
          <div className="la-grid">{g.assets.map((a) => <AssetCard key={a.slug} asset={a} />)}</div>
        </section>
      ))}
    </div>
  );
}

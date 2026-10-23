/**
 * Design-system audit helpers.
 *
 * Reads the project's real stylesheets and component sources at build time
 * (Vite `?raw` glob imports) so every value shown on /design comes straight
 * from the code — nothing here is hand-maintained.
 */

const cssModules = import.meta.glob("../../**/*.css", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const componentModules = import.meta.glob(
  ["../../components/**/*.tsx", "../../components/*.tsx"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const pageModules = import.meta.glob("../**/index.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Resolve a glob key (relative to this folder) to a `src/...` path. */
export function prettyPath(key: string): string {
  const parts = ["src", "pages", "Design"];
  for (const seg of key.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

/** Every stylesheet except this page's own (so the audit is not self-referential). */
export const cssFiles = Object.entries(cssModules)
  .map(([path, source]) => ({ path: prettyPath(path), source }))
  .filter(({ path }) => !path.startsWith("src/pages/Design/"))
  .sort((a, b) => a.path.localeCompare(b.path));

export const componentSources = Object.entries(componentModules)
  .map(([path, source]) => ({ path: prettyPath(path), source }))
  .sort((a, b) => a.path.localeCompare(b.path));

export const pageSources = Object.entries(pageModules)
  .map(([path, source]) => ({ path: prettyPath(path), source }))
  .filter(({ path }) => !path.startsWith("src/pages/Design/"))
  .sort((a, b) => a.path.localeCompare(b.path));

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

export type Declaration = { prop: string; value: string; file: string };

/** All `prop: value;` declarations across the project's CSS. */
export const declarations: Declaration[] = cssFiles.flatMap(({ path, source }) => {
  const out: Declaration[] = [];
  const re = /(?:^|[;{\s])(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*([^;{}]+?)\s*;/g;
  const css = stripComments(source);
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    out.push({ prop: m[1].toLowerCase(), value: m[2].replace(/\s+/g, " ").trim(), file: path });
  }
  return out;
});

export type Tally = { value: string; count: number; files: string[] };

function tally(values: { value: string; file: string }[]): Tally[] {
  const map = new Map<string, { count: number; files: Set<string> }>();
  for (const { value, file } of values) {
    const entry = map.get(value) ?? { count: 0, files: new Set<string>() };
    entry.count += 1;
    entry.files.add(file);
    map.set(value, entry);
  }
  return [...map.entries()]
    .map(([value, { count, files }]) => ({ value, count, files: [...files] }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function tallyProps(props: string[]): Tally[] {
  return tally(declarations.filter((d) => props.includes(d.prop)));
}

/** Numeric value tally (e.g. every `font-size` px) sorted ascending by number. */
export function tallyNumeric(props: string[], unit = "px"): Tally[] {
  const re = new RegExp(`(-?\\d*\\.?\\d+)${unit}\\b`, "g");
  const vals: { value: string; file: string }[] = [];
  for (const d of declarations) {
    if (!props.includes(d.prop)) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(d.value))) vals.push({ value: `${m[1]}${unit}`, file: d.file });
  }
  return tally(vals).sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
}

/** Every literal colour (hex / rgb[a] / hsl[a]) used anywhere in CSS. */
export function literalColors(): Tally[] {
  const re = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
  const vals: { value: string; file: string }[] = [];
  for (const d of declarations) {
    if (d.prop.startsWith("--bv-") && d.file.endsWith("src/index.css")) continue;
    const found = d.value.match(re);
    if (found) for (const c of found) vals.push({ value: c.toLowerCase().replace(/\s+/g, " "), file: d.file });
  }
  return tally(vals);
}

/** All gradient declarations. */
export function gradients(): Declaration[] {
  const seen = new Set<string>();
  return declarations.filter((d) => {
    if (!/gradient\(/.test(d.value)) return false;
    const key = d.value;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mediaQueries(): Tally[] {
  const vals: { value: string; file: string }[] = [];
  for (const { path, source } of cssFiles) {
    const re = /@media\s*([^{]+)\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(stripComments(source)))) vals.push({ value: m[1].trim().replace(/\s+/g, " "), file: path });
  }
  return tally(vals);
}

export type Keyframe = { name: string; file: string; body: string };

export function keyframes(): Keyframe[] {
  const out: Keyframe[] = [];
  for (const { path, source } of cssFiles) {
    const css = stripComments(source);
    const re = /@keyframes\s+([\w-]+)\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css))) {
      // capture balanced braces
      let depth = 1;
      let i = re.lastIndex;
      while (i < css.length && depth > 0) {
        if (css[i] === "{") depth += 1;
        else if (css[i] === "}") depth -= 1;
        i += 1;
      }
      out.push({ name: m[1], file: path, body: css.slice(re.lastIndex, i - 1).trim().replace(/\s+/g, " ") });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Durations (ms / s) used in transitions + animations, normalised to ms. */
export function durations(): Tally[] {
  const vals: { value: string; file: string }[] = [];
  const re = /(?<![\w-])(\d*\.?\d+)(ms|s)\b/g;
  for (const d of declarations) {
    if (!/^(transition|animation)/.test(d.prop) && !/^--bv-.*duration/.test(d.prop)) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(d.value))) {
      const ms = m[2] === "s" ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
      vals.push({ value: `${Math.round(ms)}ms`, file: d.file });
    }
  }
  return tally(vals).sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
}

export function easings(): Tally[] {
  const vals: { value: string; file: string }[] = [];
  const re = /cubic-bezier\([^)]*\)|var\(--bv-ease\)|\b(ease-in-out|ease-in|ease-out|ease|linear|steps\([^)]*\))\b/g;
  for (const d of declarations) {
    if (!/^(transition|animation)/.test(d.prop) && d.prop !== "--bv-ease") continue;
    const found = d.value.match(re);
    if (found) for (const e of found) vals.push({ value: e, file: d.file });
  }
  return tally(vals);
}

export type TokenBlock = Record<string, string>;

/** Parse `--bv-*` custom properties from a selector block in src/index.css. */
export function tokenBlock(selector: string, file = "src/index.css"): TokenBlock {
  const src = cssFiles.find((f) => f.path === file)?.source ?? "";
  const css = stripComments(src);
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return {};
  const end = css.indexOf("}", start);
  const body = css.slice(start + selector.length + 2, end);
  const out: TokenBlock = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out[m[1]] = m[2].replace(/\s+/g, " ").trim();
  return out;
}

/** Usage count of each CSS custom property (`var(--x)`) across CSS + TSX. */
export function varUsage(): Map<string, number> {
  const map = new Map<string, number>();
  const all = [...cssFiles, ...componentSources, ...pageSources];
  for (const { source } of all) {
    const re = /var\((--[\w-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) map.set(m[1], (map.get(m[1]) ?? 0) + 1);
  }
  return map;
}

/** Icons imported from react-ionicons, with the files that use them. */
export function ionicons(): Tally[] {
  const vals: { value: string; file: string }[] = [];
  for (const { path, source } of [...componentSources, ...pageSources]) {
    const re = /import\s*\{([^}]*)\}\s*from\s*"react-ionicons"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      for (const name of m[1].split(",").map((s) => s.trim()).filter(Boolean)) vals.push({ value: name, file: path });
    }
  }
  return tally(vals).sort((a, b) => a.value.localeCompare(b.value));
}

/** Count inline <svg> elements per source file (hand-drawn icons / drawings). */
export function inlineSvgFiles(): Tally[] {
  const vals: { value: string; file: string }[] = [];
  for (const { path, source } of [...componentSources, ...pageSources]) {
    const n = (source.match(/<svg\b/g) ?? []).length;
    for (let i = 0; i < n; i += 1) vals.push({ value: path, file: path });
  }
  return tally(vals);
}

/** Extract `type XProps = { ... }` / `interface XProps { ... }` blocks. */
export function propsBlocks(source: string): string[] {
  const out: string[] = [];
  const re = /(?:type\s+(\w*Props)\s*(?:<[^>]*>)?\s*=\s*\{|interface\s+(\w*Props)\s*\{)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") depth -= 1;
      i += 1;
    }
    out.push(source.slice(m.index, i).trim());
  }
  return out;
}

/** Top-level CSS class names (BEM roots + modifiers) defined in a stylesheet. */
export function classNames(cssPath: string): string[] {
  const src = cssFiles.find((f) => f.path === cssPath)?.source ?? "";
  const set = new Set<string>();
  const re = /\.([a-zA-Z_][\w-]*)/g;
  let m: RegExpExecArray | null;
  const css = stripComments(src).replace(/url\([^)]*\)/g, "");
  while ((m = re.exec(css))) if (!/^\d/.test(m[1])) set.add(m[1]);
  return [...set].sort();
}

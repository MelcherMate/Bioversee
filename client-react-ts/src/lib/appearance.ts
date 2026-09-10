export type ThemePreference = "light" | "dark" | "system";
export type AppLanguage = "en" | "de" | "hu";

export type AppearanceSettings = {
  theme: ThemePreference;
  accent: string;
  language: AppLanguage;
};

const STORAGE_KEY = "bv.appearance.v1";

/** Soft teal — current Bioversee green. */
export const DEFAULT_ACCENT = "#0d9488";

/**
 * Accent palette: same soft/vivid character as teal + user yellow.
 * Yellow from product preference; red/blue chosen to match.
 */
export const ACCENT_PRESETS = [
  { id: "green", label: "Green", value: "#0d9488" },
  { id: "yellow", label: "Yellow", value: "#ffe15d" },
  { id: "red", label: "Red", value: "#ff6b6b" },
  { id: "blue", label: "Blue", value: "#5b9fff" },
] as const;

export const LANGUAGE_OPTIONS: {
  value: AppLanguage;
  label: string;
  native: string;
}[] = [
  { value: "en", label: "English", native: "English" },
  { value: "de", label: "German", native: "Deutsch" },
  { value: "hu", label: "Hungarian", native: "Magyar" },
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "system",
  accent: DEFAULT_ACCENT,
  language: "en",
};

function isTheme(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function isLanguage(value: unknown): value is AppLanguage {
  return value === "en" || value === "de" || value === "hu";
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function normalizeHex(value: string): string {
  const raw = value.startsWith("#") ? value : `#${value}`;
  return raw.toLowerCase();
}

export function loadAppearance(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
    return {
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_APPEARANCE.theme,
      accent: isHexColor(parsed.accent)
        ? parsed.accent.toLowerCase()
        : DEFAULT_APPEARANCE.accent,
      language: isLanguage(parsed.language)
        ? parsed.language
        : DEFAULT_APPEARANCE.language,
    };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(settings: AppearanceSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function appearanceFromPrefs(
  prefs: Partial<AppearanceSettings> | null | undefined
): AppearanceSettings | null {
  if (!prefs || typeof prefs !== "object") return null;
  const next: AppearanceSettings = { ...DEFAULT_APPEARANCE };
  let touched = false;
  if (isTheme(prefs.theme)) {
    next.theme = prefs.theme;
    touched = true;
  }
  if (isHexColor(prefs.accent)) {
    next.accent = prefs.accent.toLowerCase();
    touched = true;
  }
  if (isLanguage(prefs.language)) {
    next.language = prefs.language;
    touched = true;
  }
  return touched ? next : null;
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark = typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
): "light" | "dark" {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return a;
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  const r = mix(A.r, B.r).toString(16).padStart(2, "0");
  const g = mix(A.g, B.g).toString(16).padStart(2, "0");
  const bl = mix(A.b, B.b).toString(16).padStart(2, "0");
  return `#${r}${g}${bl}`;
}

/** Brighten darker accents in night mode (Smart Grid style). */
export function accentForResolvedTheme(
  accent: string,
  theme: "light" | "dark"
): string {
  const hex = normalizeHex(accent);
  if (theme === "light") return hex;
  const L = relativeLuminance(hex);
  if (L >= 0.55) return hex;
  return mixHex(hex, "#ffffff", 0.38);
}

/** Apply resolved theme + accent CSS variables on <html>. */
export function applyAppearance(settings: AppearanceSettings): void {
  const root = document.documentElement;
  const resolved = resolveTheme(settings.theme);
  const accent = accentForResolvedTheme(settings.accent, resolved);
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  root.style.setProperty("--bv-user-accent", normalizeHex(settings.accent));
  root.style.setProperty("--bv-accent", accent);
  root.lang = settings.language;
}

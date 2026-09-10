export type ThemePreference = "light" | "dark" | "system";
export type AppLanguage = "en" | "de" | "hu";

export type AppearanceSettings = {
  theme: ThemePreference;
  accent: string;
  language: AppLanguage;
};

const STORAGE_KEY = "bv.appearance.v1";

export const DEFAULT_ACCENT = "#0d9488";

export const ACCENT_PRESETS = [
  { id: "teal", label: "Teal", value: "#0d9488" },
  { id: "blue", label: "Blue", value: "#2563eb" },
  { id: "indigo", label: "Indigo", value: "#4f46e5" },
  { id: "rose", label: "Rose", value: "#e11d48" },
  { id: "orange", label: "Orange", value: "#ea580c" },
  { id: "green", label: "Green", value: "#16a34a" },
  { id: "slate", label: "Slate", value: "#475569" },
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

export function resolveTheme(
  preference: ThemePreference,
  systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
): "light" | "dark" {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

/** Apply resolved theme + accent CSS variables on <html>. */
export function applyAppearance(settings: AppearanceSettings): void {
  const root = document.documentElement;
  const resolved = resolveTheme(settings.theme);
  root.dataset.theme = resolved;
  root.style.setProperty("--bv-accent", settings.accent);
  root.lang = settings.language;
}

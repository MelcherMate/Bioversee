import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyAppearance,
  loadAppearance,
  saveAppearance,
  type AppearanceSettings,
  type AppLanguage,
  type ThemePreference,
} from "./appearance";

type AppearanceContextValue = {
  settings: AppearanceSettings;
  setTheme: (theme: ThemePreference) => void;
  setAccent: (accent: string) => void;
  setLanguage: (language: AppLanguage) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(() =>
    loadAppearance()
  );

  useEffect(() => {
    applyAppearance(settings);
    saveAppearance(settings);
  }, [settings]);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance(settings);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [settings]);

  const setTheme = useCallback((theme: ThemePreference) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const setAccent = useCallback((accent: string) => {
    const next = accent.startsWith("#") ? accent : `#${accent}`;
    setSettings((prev) => ({ ...prev, accent: next.toLowerCase() }));
  }, []);

  const setLanguage = useCallback((language: AppLanguage) => {
    setSettings((prev) => ({ ...prev, language }));
  }, []);

  const value = useMemo(
    () => ({ settings, setTheme, setAccent, setLanguage }),
    [settings, setTheme, setAccent, setLanguage]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return ctx;
}

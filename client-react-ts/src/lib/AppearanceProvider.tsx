import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyAppearance,
  loadAppearance,
  normalizeHex,
  saveAppearance,
  type AppearanceSettings,
  type AppLanguage,
  type ThemePreference,
} from "./appearance";
import { supabase } from "./supabase";
import {
  loadAppearanceFromCloud,
  mergeUserPreferences,
} from "./userSettings";

type AppearanceContextValue = {
  settings: AppearanceSettings;
  cloudReady: boolean;
  setTheme: (theme: ThemePreference) => void;
  setAccent: (accent: string) => void;
  setLanguage: (language: AppLanguage) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(() =>
    loadAppearance()
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const skipNextCloudWrite = useRef(false);
  const loadGen = useRef(0);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.session?.user.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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

  /** Load preferences from Supabase for the signed-in user. */
  useEffect(() => {
    if (!userId) {
      setCloudReady(false);
      return;
    }

    const gen = ++loadGen.current;
    setCloudReady(false);

    void loadAppearanceFromCloud(userId).then((remote) => {
      if (loadGen.current !== gen) return;
      if (remote) {
        skipNextCloudWrite.current = true;
        setSettings(remote);
        saveAppearance(remote);
      }
      setCloudReady(true);
    });
  }, [userId]);

  /** Persist to cloud when settings change (after initial load). */
  useEffect(() => {
    if (!userId || !cloudReady) return;
    if (skipNextCloudWrite.current) {
      skipNextCloudWrite.current = false;
      return;
    }

    const handle = window.setTimeout(() => {
      void mergeUserPreferences(userId, {
        theme: settings.theme,
        accent: normalizeHex(settings.accent),
        language: settings.language,
      });
    }, 350);

    return () => window.clearTimeout(handle);
  }, [userId, cloudReady, settings]);

  const setTheme = useCallback((theme: ThemePreference) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const setAccent = useCallback((accent: string) => {
    setSettings((prev) => ({ ...prev, accent: normalizeHex(accent) }));
  }, []);

  const setLanguage = useCallback((language: AppLanguage) => {
    setSettings((prev) => ({ ...prev, language }));
  }, []);

  const value = useMemo(
    () => ({ settings, cloudReady, setTheme, setAccent, setLanguage }),
    [settings, cloudReady, setTheme, setAccent, setLanguage]
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

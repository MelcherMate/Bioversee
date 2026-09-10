import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppConnectivity = "online" | "offline" | "degraded";

type AppStatusContextValue = {
  connectivity: AppConnectivity;
  /** Optional short reason shown in tooltips / future toasts. */
  issue: string | null;
  reportIssue: (message: string | null) => void;
  clearIssue: () => void;
};

const AppStatusContext = createContext<AppStatusContextValue | null>(null);

export function AppStatusProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [issue, setIssue] = useState<string | null>(null);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const reportIssue = useCallback((message: string | null) => {
    setIssue(message && message.trim() ? message.trim() : null);
  }, []);

  const clearIssue = useCallback(() => setIssue(null), []);

  const connectivity: AppConnectivity = !online
    ? "offline"
    : issue
      ? "degraded"
      : "online";

  const value = useMemo(
    () => ({ connectivity, issue, reportIssue, clearIssue }),
    [connectivity, issue, reportIssue, clearIssue]
  );

  return (
    <AppStatusContext.Provider value={value}>
      {children}
    </AppStatusContext.Provider>
  );
}

export function useAppStatus(): AppStatusContextValue {
  const ctx = useContext(AppStatusContext);
  if (!ctx) {
    throw new Error("useAppStatus must be used within AppStatusProvider");
  }
  return ctx;
}

export function connectivityLabel(status: AppConnectivity): string {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline — app stays open";
    case "degraded":
      return "Something needs attention";
  }
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import "./App.css";
import DevDataPanel from "./components/DevDataPanel";
import MarketingHeader from "./components/MarketingHeader";
import Navbar from "./components/Navbar";
import OnboardingModal from "./components/OnboardingModal";
import { AppStatusProvider } from "./lib/appStatus";
import { syncAccountVaultFromSession, enforceSessionMaxAge } from "./lib/accountSessions";
import { APP_HOME_PATH, legacyDashboardRedirect } from "./lib/sharing";
import { supabase } from "./lib/supabase";
import { type AppUser, toAppUser } from "./lib/user";
import About from "./pages/About";
import Bioreactor from "./pages/Bioreactor";
import Invite from "./pages/Invite";
import IosAuthBridge from "./pages/IosAuthBridge";
import Login from "./pages/Login";
import MembraneBioreactor from "./pages/MembraneBioreactor";
import PiSetup from "./pages/PiSetup";
import PressureVessel from "./pages/PressureVessel";
import WaterPurifier from "./pages/WaterPurifier";

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  const [pathname, query = ""] = raw.split("?");
  const mapped = legacyDashboardRedirect(pathname) ?? pathname;
  return query ? `${mapped}?${query}` : mapped;
}

function HomeRedirect() {
  const [searchParams] = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  return <Navigate to={nextPath ?? APP_HOME_PATH} replace />;
}

function LegacyProcessRedirect() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const target = legacyDashboardRedirect(pathname) ?? APP_HOME_PATH;
  const qs = searchParams.toString();
  return <Navigate to={qs ? `${target}?${qs}` : target} replace />;
}

const App = () => {
  const { t } = useTranslation();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [devPanelOpen, setDevPanelOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      await enforceSessionMaxAge();
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      // Realtime WebSocket often connects as anon unless JWT is set explicitly;
      // without this, RLS silently drops postgres_changes from other clients.
      if (data.session?.access_token) {
        await supabase.realtime.setAuth(data.session.access_token);
      }
      syncAccountVaultFromSession(data.session, "INITIAL_SESSION");
      setUser(data.session?.user ? toAppUser(data.session.user) : null);
      setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      void supabase.realtime.setAuth(session?.access_token ?? null);
      syncAccountVaultFromSession(session, event);
      setUser(session?.user ? toAppUser(session.user) : null);
      setLoading(false);
    });

    const interval = window.setInterval(() => {
      void enforceSessionMaxAge();
    }, 60 * 60 * 1000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setDevPanelOpen(false);
      return;
    }

    const pressed = new Set<string>();

    const normalize = (key: string) => key.toLowerCase();

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      pressed.add(normalize(event.key));
      if (pressed.has("l") && pressed.has("b")) {
        event.preventDefault();
        setDevPanelOpen((open) => !open);
        pressed.clear();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      pressed.delete(normalize(event.key));
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="appContainer appContainer--loading">
        <div className="app-loader">
          <span className="app-loader__dot" />
          {t("app.loading")}
        </div>
      </div>
    );
  }

  return (
    <AppStatusProvider>
      <BrowserRouter>
        <AppShell
          user={user}
          devPanelOpen={devPanelOpen}
          setDevPanelOpen={setDevPanelOpen}
        />
      </BrowserRouter>
    </AppStatusProvider>
  );
};

type AppShellProps = {
  user: AppUser | null;
  devPanelOpen: boolean;
  setDevPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

function AppShell({ user, devPanelOpen, setDevPanelOpen }: AppShellProps) {
  const { pathname } = useLocation();
  const addingAccount = pathname === "/add-account";
  const onInvite = pathname.startsWith("/invite/");
  const onIosAuth = pathname === "/ios-auth";
  const onLanding =
    pathname === "/about" ||
    pathname === "/pi-setup" ||
    (pathname === "/" && !user);
  const showChrome = Boolean(user) && !addingAccount && !onIosAuth;
  const showMarketingHeader = onLanding && !user && pathname !== "/pi-setup";
  const showOnboarding = Boolean(user) && showChrome && !onInvite;

  const loginRedirect = (next: string) => (
    <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  );

  return (
    <div
      className={[
        "appContainer",
        showChrome || onLanding ? "" : "appContainer--auth",
        onLanding ? "appContainer--landing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showMarketingHeader && <MarketingHeader />}
      {showChrome && user && <Navbar user={user} />}
      <div className={`page-slot${onLanding ? " page-slot--landing" : ""}`}>
        <Routes>
          <Route path="/" element={user ? <HomeRedirect /> : <About />} />
          <Route
            path="/login"
            element={user ? <HomeRedirect /> : <Login />}
          />
          <Route path="/add-account" element={<Login mode="add-account" />} />
          <Route
            path="/dashboard"
            element={<Navigate to={APP_HOME_PATH} replace />}
          />
          <Route
            path="/dashboard/bioreactor"
            element={
              user ? <Bioreactor user={user} /> : loginRedirect(APP_HOME_PATH)
            }
          />
          <Route
            path="/dashboard/pressure-vessel"
            element={
              user ? (
                <PressureVessel user={user} />
              ) : (
                loginRedirect("/dashboard/pressure-vessel")
              )
            }
          />
          <Route
            path="/dashboard/membrane-bioreactor"
            element={
              user ? (
                <MembraneBioreactor user={user} />
              ) : (
                loginRedirect("/dashboard/membrane-bioreactor")
              )
            }
          />
          <Route
            path="/dashboard/water-purifier"
            element={
              user ? (
                <WaterPurifier user={user} />
              ) : (
                loginRedirect("/dashboard/water-purifier")
              )
            }
          />
          <Route path="/bioreactor" element={<LegacyProcessRedirect />} />
          <Route path="/pressure-vessel" element={<LegacyProcessRedirect />} />
          <Route
            path="/membrane-bioreactor"
            element={<LegacyProcessRedirect />}
          />
          <Route path="/waterpurifier" element={<LegacyProcessRedirect />} />
          <Route path="/water-purifier" element={<LegacyProcessRedirect />} />
          <Route path="/invite/:token" element={<Invite user={user} />} />
          <Route path="/ios-auth" element={<IosAuthBridge />} />
          <Route path="/about" element={<About />} />
          <Route path="/pi-setup" element={<PiSetup />} />
          <Route
            path="/settings"
            element={<Navigate to={APP_HOME_PATH} replace />}
          />
        </Routes>
      </div>
      {user && showOnboarding && <OnboardingModal user={user} />}
      {user && showChrome && (
        <DevDataPanel
          open={devPanelOpen}
          onClose={() => setDevPanelOpen(false)}
          user={user}
        />
      )}
    </div>
  );
}

export default App;

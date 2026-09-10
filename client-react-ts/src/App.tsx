import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import DevDataPanel from "./components/DevDataPanel";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import { supabase } from "./lib/supabase";
import { type AppUser, toAppUser } from "./lib/user";
import About from "./pages/About";
import Bioreactor from "./pages/Bioreactor";
import Login from "./pages/Login";
import MembraneBioreactor from "./pages/MembraneBioreactor";
import PressureVessel from "./pages/PressureVessel";
import Settings from "./pages/Settings";
import WaterPurifier from "./pages/WaterPurifier";

const App = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [devPanelOpen, setDevPanelOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ? toAppUser(data.session.user) : null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toAppUser(session.user) : null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
          Loading Bioversee…
        </div>
      </div>
    );
  }

  const showChrome = Boolean(user);

  return (
    <BrowserRouter>
      <div
        className={`appContainer ${showChrome ? "" : "appContainer--auth"}`.trim()}
      >
        {showChrome && <Navbar user={user} />}
        <div className="page-slot">
          <Routes>
            <Route
              path="/"
              element={user ? <Navigate to="/bioreactor" /> : <Login />}
            />
            <Route
              path="/bioreactor"
              element={user ? <Bioreactor user={user} /> : <Login />}
            />
            <Route
              path="/pressure-vessel"
              element={user ? <PressureVessel /> : <Login />}
            />
            <Route
              path="/membrane-bioreactor"
              element={user ? <MembraneBioreactor /> : <Login />}
            />
            <Route
              path="/waterpurifier"
              element={user ? <WaterPurifier user={user} /> : <Login />}
            />
            <Route path="/settings" element={user ? <Settings /> : <Login />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
        {showChrome && <Footer />}
        {user && (
          <DevDataPanel
            open={devPanelOpen}
            onClose={() => setDevPanelOpen(false)}
            user={user}
          />
        )}
      </div>
    </BrowserRouter>
  );
};

export default App;

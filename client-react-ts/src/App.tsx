import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import { supabase } from "./lib/supabase";
import { type AppUser, toAppUser } from "./lib/user";
import About from "./pages/About";
import Bioreactor from "./pages/Bioreactor";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import WaterPurifier from "./pages/WaterPurifier";

const App = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="appContainer">Loading…</div>;
  }

  return (
    <BrowserRouter>
      <div className="appContainer">
        <Navbar user={user} />
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
            path="/waterpurifier"
            element={user ? <WaterPurifier user={user} /> : <Login />}
          />
          <Route path="/settings" element={user ? <Settings /> : <Login />} />
          <Route path="/about" element={<About />} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;

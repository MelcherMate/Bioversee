import { FormEvent, useState } from "react";
import Google from "../../img/google.png";
import Logo from "../../img/new_logo.png";
import { supabase } from "../../lib/supabase";
import "./Login.css";

const Login = () => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setMessage("Check your email to confirm your account, then sign in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
    }
  };

  return (
    <div id="loginPage">
      <div id="loginBox">
        <h2 id="loginTitle">Bioversee</h2>
        <img src={Logo} id="loginLogo" alt="Bioversee logo" />
        <p id="slogan">
          Automation for <br /> EVERYONE
        </p>

        <form className="authForm" onSubmit={onSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          <button type="submit" className="loginButton email" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          type="button"
          className="modeToggle"
          onClick={() =>
            setMode((current) => (current === "signin" ? "signup" : "signin"))
          }
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Have an account? Sign in"}
        </button>

        <div className="divider">or</div>

        <div className="loginButton google" onClick={signInWithGoogle}>
          <img src={Google} alt="" className="icon" />
          Continue with Google
        </div>

        {error && <p className="authError">{error}</p>}
        {message && <p className="authMessage">{message}</p>}
      </div>
      <h6 className="note">
        Note: This website is just a DEMO site for BIOVERSEE
      </h6>
    </div>
  );
};

export default Login;

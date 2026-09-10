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
    <div className="auth-shell">
      <div className="auth-shell__veil" aria-hidden />
      <div className="auth-card">
        <header className="auth-card__header">
          <div className="auth-card__header-start">
            <div className="auth-card__mark">
              <img src={Logo} alt="" />
            </div>
            <div className="auth-card__headline">
              <p className="auth-card__eyebrow">Bioversee</p>
              <h1 className="auth-card__title">Welcome</h1>
              <p className="auth-card__subtitle">
                Automation for everyone — control industrial equipment from the
                cloud.
              </p>
            </div>
          </div>
        </header>

        <div className="auth-card__body">
          <div className="auth-segment" role="tablist">
            <button
              type="button"
              className={mode === "signin" ? "is-active" : undefined}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "signup" ? "is-active" : undefined}
              onClick={() => setMode("signup")}
            >
              Sign up
            </button>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
              />
            </label>
            <button type="submit" className="auth-cta" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <div className="auth-or">
            <span>or</span>
          </div>

          <button
            type="button"
            className="auth-social"
            onClick={signInWithGoogle}
          >
            <img src={Google} alt="" />
            Continue with Google
          </button>

          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-message">{message}</p>}

          <p className="auth-note">Demo site for Bioversee prototypes</p>
        </div>
      </div>
    </div>
  );
};

export default Login;

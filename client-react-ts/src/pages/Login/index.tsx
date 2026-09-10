import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Google from "../../img/google.png";
import Logo from "../../utils/svgs/new_logo.svg";
import SegmentedControl from "../../components/SegmentedControl";
import { upsertStoredSession } from "../../lib/accountSessions";
import { supabase } from "../../lib/supabase";
import "./Login.css";

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

type LoginProps = {
  mode?: "default" | "add-account";
};

const Login = ({ mode: loginMode = "default" }: LoginProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addingAccount = loginMode === "add-account";
  const nextPath = safeNextPath(searchParams.get("next"));
  const prefillsEmail = searchParams.get("email") ?? "";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(prefillsEmail);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (prefillsEmail) setEmail(prefillsEmail);
  }, [prefillsEmail]);

  useEffect(() => {
    if (!addingAccount) return;
    // Snapshot the current session so it stays available after the new sign-in.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        upsertStoredSession(data.session, { resetSignedInAt: false });
      }
    });
  }, [addingAccount]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        if (addingAccount) {
          navigate("/bioreactor", { replace: true });
          return;
        }
        if (nextPath) {
          navigate(nextPath, { replace: true });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, nextPath, addingAccount]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (addingAccount) {
        const { data: current } = await supabase.auth.getSession();
        if (current.session) {
          upsertStoredSession(current.session, { resetSignedInAt: false });
        }
      }

      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          upsertStoredSession(data.session, { resetSignedInAt: true });
        }
        navigate(addingAccount ? "/bioreactor" : nextPath ?? "/bioreactor", {
          replace: true,
        });
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
    if (addingAccount) {
      const { data: current } = await supabase.auth.getSession();
      if (current.session) {
        upsertStoredSession(current.session, { resetSignedInAt: false });
      }
    }
    const redirectTo = addingAccount
      ? `${window.location.origin}/bioreactor`
      : nextPath
        ? `${window.location.origin}${nextPath}`
        : window.location.origin;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
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
              <h1 className="auth-card__title">
                {addingAccount ? "Add account" : "Welcome"}
              </h1>
              <p className="auth-card__subtitle">
                {addingAccount
                  ? "Sign in with another account. Your current account stays signed in on this device."
                  : "Automation for everyone — control industrial equipment from the cloud."}
              </p>
            </div>
          </div>
        </header>

        <div className="auth-card__body">
          <SegmentedControl<"signin" | "signup">
            className="auth-segment"
            shape="pill"
            aria-label="Authentication mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Sign up" },
            ]}
          />

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
                  ? addingAccount
                    ? "Add account"
                    : "Sign in"
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

          {addingAccount && (
            <Link className="auth-note auth-note--link" to="/bioreactor">
              Cancel and stay on current account
            </Link>
          )}

          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-message">{message}</p>}

          {!addingAccount && (
            <p className="auth-note">Demo site for Bioversee prototypes</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import GoogleMark from "../../components/GoogleMark";
import Logo from "../../utils/svgs/new_logo.svg";
import SegmentedControl from "../../components/SegmentedControl";
import { upsertStoredSession } from "../../lib/accountSessions";
import {
  getLastLoginMethod,
  setLastLoginMethod,
  type LastLoginMethod,
} from "../../lib/lastLoginMethod";
import { supabase } from "../../lib/supabase";
import "../Login/Login.css";
import "./PiLogin.css";

const ALLOWED_CALLBACK =
  /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/auth\/callback\/?$/i;

function safePiCallback(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const base = `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, "");
    if (!ALLOWED_CALLBACK.test(`${base}/`) && !ALLOWED_CALLBACK.test(base)) {
      // Accept exact /auth/callback path
      if (!/\/auth\/callback$/i.test(url.pathname)) return null;
      if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
        return null;
      }
    }
    return `${url.protocol}//${url.host}/auth/callback`;
  } catch {
    return null;
  }
}

/**
 * Login for the Raspberry Pi desktop app.
 * After sign-in, returns the user to the local app with session tokens.
 */
function PiLogin() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const callback = useMemo(
    () => safePiCallback(searchParams.get("redirect")),
    [searchParams]
  );
  const state = searchParams.get("state") ?? "";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastLoginMethod, setLastLoginMethodState] = useState<LastLoginMethod | null>(
    () => getLastLoginMethod()
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const rememberLoginMethod = (method: LastLoginMethod) => {
    setLastLoginMethod(method);
    setLastLoginMethodState(method);
  };

  const returnToApp = async () => {
    if (!callback) {
      setError(t("piLogin.badRedirect"));
      return;
    }
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.access_token) {
      setError(t("piLogin.noSession"));
      return;
    }

    const hash = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token ?? "",
      expires_at: String(session.expires_at ?? ""),
      state,
      email: session.user?.email ?? "",
    });

    setDone(true);
    window.location.href = `${callback}#${hash.toString()}`;
  };

  useEffect(() => {
    if (!callback) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        void returnToApp();
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback, state]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!callback) {
      setError(t("piLogin.badRedirect"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        rememberLoginMethod("email");
        if (data.session) {
          upsertStoredSession(data.session);
          await returnToApp();
        } else {
          setMessage(t("piLogin.confirmEmail"));
        }
      } else {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        rememberLoginMethod("email");
        if (data.session) {
          upsertStoredSession(data.session);
          await returnToApp();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    if (!callback) {
      setError(t("piLogin.badRedirect"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      rememberLoginMethod("google");
      const redirectTo = `${window.location.origin}/pi-login?${new URLSearchParams({
        redirect: callback,
        state,
      }).toString()}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="auth-shell pi-login">
        <div className="auth-shell__veil" aria-hidden />
        <div className="auth-card">
          <div className="auth-card__mark">
            <img src={Logo} alt="" />
          </div>
          <h1 className="auth-card__title">{t("piLogin.returning")}</h1>
          <p className="auth-card__subtitle">{t("piLogin.returningBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell pi-login">
      <div className="auth-shell__veil" aria-hidden />
      <div className="auth-card">
        <header className="auth-card__header">
          <div className="auth-card__header-start">
            <div className="auth-card__mark">
              <img src={Logo} alt="" />
            </div>
            <div className="auth-card__headline">
              <p className="auth-card__eyebrow">{t("common.brand")}</p>
              <h1 className="auth-card__title">{t("piLogin.title")}</h1>
              <p className="auth-card__subtitle">{t("piLogin.lede")}</p>
            </div>
          </div>
        </header>

        <div className="auth-card__body">
          {!callback && <p className="auth-error">{t("piLogin.openFromApp")}</p>}

          <SegmentedControl<"signin" | "signup">
            className="auth-segment"
            shape="pill"
            aria-label={t("auth.signIn")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "signin", label: t("auth.signIn") },
              { value: "signup", label: t("auth.signUp") },
            ]}
          />

          <form className="auth-form" onSubmit={onSubmit}>
            <label className="auth-field">
              <span>{t("auth.email")}</span>
              <input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="auth-field">
              <span>{t("auth.password")}</span>
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
            {error && <p className="auth-error">{error}</p>}
            {message && <p className="auth-note">{message}</p>}
            <button
              type="submit"
              className={`auth-cta${
                lastLoginMethod === "email" && mode === "signin"
                  ? " auth-cta--with-badge"
                  : ""
              }`}
              disabled={busy || !callback}
            >
              {busy
                ? t("auth.pleaseWait")
                : mode === "signin"
                  ? t("auth.signIn")
                  : t("auth.createAccount")}
              {lastLoginMethod === "email" && mode === "signin" ? (
                <span className="auth-last-used">{t("auth.lastUsed")}</span>
              ) : null}
            </button>
          </form>

          <div className="auth-or">
            <span>{t("common.or")}</span>
          </div>

          <button
            type="button"
            className={`auth-social auth-social--google${
              lastLoginMethod === "google" ? " auth-social--with-badge" : ""
            }`}
            onClick={onGoogle}
            disabled={busy || !callback}
          >
            <span className="auth-social__icon" aria-hidden>
              <GoogleMark size={18} />
            </span>
            <span className="auth-social__label">{t("auth.continueGoogle")}</span>
            {lastLoginMethod === "google" ? (
              <span className="auth-last-used">{t("auth.lastUsed")}</span>
            ) : null}
          </button>

          <Link className="auth-note auth-note--link" to="/about">
            {t("piLogin.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PiLogin;

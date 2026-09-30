import { Lottie } from "lottie-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import emailSentAnimation from "../../assets/animations/email-sent.json";
import GoogleMark from "../../components/GoogleMark";
import {
  useAnimationPreview,
  type AnimationPreviewId,
} from "../../components/AnimationLab/preview";
import Logo from "../../utils/svgs/new_logo.svg";
import SegmentedControl from "../../components/SegmentedControl";
import { ToastStack, useToasts } from "../../components/Toast";
import { upsertStoredSession } from "../../lib/accountSessions";
import { APP_HOME_PATH, legacyDashboardRedirect } from "../../lib/sharing";
import { supabase } from "../../lib/supabase";
import "./Login.css";

function formatAuthError(
  message: string,
  t: (key: string) => string
): { title: string; detail?: string } {
  const normalized = message.trim().toLowerCase();
  if (normalized.includes("rate limit")) {
    return {
      title: t("auth.rateLimitTitle"),
      detail: t("auth.rateLimitDetail"),
    };
  }
  return { title: message || t("auth.authFailed") };
}

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  const [pathname, query = ""] = raw.split("?");
  const mapped = legacyDashboardRedirect(pathname) ?? pathname;
  return query ? `${mapped}?${query}` : mapped;
}

type LoginProps = {
  mode?: "default" | "add-account";
};

type PasswordRuleId =
  | "length"
  | "lower"
  | "upper"
  | "number"
  | "special";

type PasswordRule = {
  id: PasswordRuleId;
  labelKey: string;
  test: (value: string) => boolean;
};

const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    labelKey: "auth.passwordRuleLength",
    test: (value) => value.length >= 8,
  },
  {
    id: "lower",
    labelKey: "auth.passwordRuleLower",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "upper",
    labelKey: "auth.passwordRuleUpper",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "number",
    labelKey: "auth.passwordRuleNumber",
    test: (value) => /\d/.test(value),
  },
  {
    id: "special",
    labelKey: "auth.passwordRuleSpecial",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

function passwordStrengthLevel(metCount: number): "empty" | "weak" | "fair" | "strong" {
  if (metCount <= 0) return "empty";
  if (metCount <= 2) return "weak";
  if (metCount <= 4) return "fair";
  return "strong";
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3.16 3.88 1.9 5.14l3.05 3.05A12.6 12.6 0 0 0 1 12c1.73 3.89 6 7 11 7 1.86 0 3.6-.4 5.16-1.1l3.7 3.7 1.26-1.26L3.16 3.88zM12 17c-3.53 0-6.64-2.05-8.25-5a10.1 10.1 0 0 1 2.9-3.1l1.66 1.66A4.98 4.98 0 0 0 12 17zm0-10c3.53 0 6.64 2.05 8.25 5a10.2 10.2 0 0 1-1.72 2.3l-1.45-1.45A4.98 4.98 0 0 0 12 7zm-1.2 3.05 3.15 3.15A2.5 2.5 0 0 1 10.8 10.05z"
      />
    </svg>
  );
}

const Login = ({ mode: loginMode = "default" }: LoginProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addingAccount = loginMode === "add-account";
  const nextPath = safeNextPath(searchParams.get("next"));
  const prefillsEmail = searchParams.get("email") ?? "";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(prefillsEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(
    null
  );
  const [verifyAnimKey, setVerifyAnimKey] = useState(0);
  const [verifyCopyVisible, setVerifyCopyVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const showAuthError = useCallback(
    (message: string) => {
      const { title, detail } = formatAuthError(message, t);
      push("error", title, detail);
    },
    [push, t]
  );

  const ruleStates = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        ...rule,
        met: rule.test(password),
      })),
    [password]
  );
  const metCount = ruleStates.filter((rule) => rule.met).length;
  const strength = passwordStrengthLevel(metCount);

  const onAnimationPreview = useCallback(
    (id: AnimationPreviewId) => {
      if (id === "auth-form") {
        setPendingVerifyEmail(null);
        return;
      }
      if (id === "auth-verify" || id === "auth-verify-replay") {
        const demoEmail = email.trim() || "you@example.com";
        if (id === "auth-verify-replay") {
          setPendingVerifyEmail(null);
          window.setTimeout(() => {
            setPendingVerifyEmail(demoEmail);
            setVerifyAnimKey((key) => key + 1);
          }, 40);
          return;
        }
        setPendingVerifyEmail(demoEmail);
        setVerifyAnimKey((key) => key + 1);
      }
    },
    [email]
  );
  useAnimationPreview(onAnimationPreview);

  useEffect(() => {
    if (!pendingVerifyEmail) {
      setVerifyCopyVisible(false);
      return;
    }
    setVerifyCopyVisible(false);
    const timer = window.setTimeout(() => setVerifyCopyVisible(true), 850);
    return () => window.clearTimeout(timer);
  }, [pendingVerifyEmail, verifyAnimKey]);

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
          navigate(APP_HOME_PATH, { replace: true });
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
        navigate(addingAccount ? APP_HOME_PATH : nextPath ?? APP_HOME_PATH, {
          replace: true,
        });
      } else {
        const trimmedUsername = username.trim();
        if (!trimmedUsername) {
          throw new Error(t("auth.usernameRequired"));
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: trimmedUsername,
              full_name: trimmedUsername,
              name: trimmedUsername,
            },
          },
        });
        if (signUpError) throw signUpError;
        setPendingVerifyEmail(email.trim());
        setPassword("");
        setShowPassword(false);
      }
    } catch (err) {
      showAuthError(
        err instanceof Error ? err.message : t("auth.authFailed")
      );
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    if (addingAccount) {
      const { data: current } = await supabase.auth.getSession();
      if (current.session) {
        upsertStoredSession(current.session, { resetSignedInAt: false });
      }
    }
    const redirectTo = addingAccount
      ? `${window.location.origin}${APP_HOME_PATH}`
      : nextPath
        ? `${window.location.origin}${nextPath}`
        : `${window.location.origin}${APP_HOME_PATH}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          // Always show Google's account chooser (avoids silent reuse of last account).
          prompt: "select_account",
        },
      },
    });
    if (oauthError) {
      showAuthError(oauthError.message);
    }
  };

  return (
    <div className="auth-shell">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div className="auth-shell__veil" aria-hidden />
      <div className="auth-card">
        <header className="auth-card__header">
          <div className="auth-card__header-start">
            <div className="auth-card__mark">
              <img src={Logo} alt="" />
            </div>
            <div className="auth-card__headline">
              <p className="auth-card__eyebrow">{t("common.brand")}</p>
              <h1 className="auth-card__title">
                {pendingVerifyEmail
                  ? verifyCopyVisible
                    ? t("auth.verifyTitle")
                    : "\u00a0"
                  : addingAccount
                    ? t("auth.addAccount")
                    : t("auth.welcome")}
              </h1>
              <p className="auth-card__subtitle">
                {pendingVerifyEmail
                  ? verifyCopyVisible
                    ? t("auth.verifySubtitle")
                    : "\u00a0"
                  : addingAccount
                    ? t("auth.addAccountSubtitle")
                    : t("auth.subtitle")}
              </p>
            </div>
          </div>
        </header>

        <div className="auth-card__body">
          {pendingVerifyEmail ? (
            <div
              className="auth-verify"
              role="status"
              aria-live="polite"
              key={verifyAnimKey}
            >
              <div className="auth-verify__lottie" aria-hidden>
                <Lottie
                  src={emailSentAnimation}
                  className="auth-verify__lottie-player"
                  loop={false}
                  autoplay
                />
              </div>

              <div
                className={
                  verifyCopyVisible
                    ? "auth-verify__copy is-visible"
                    : "auth-verify__copy"
                }
              >
                <div className="auth-verify__address">
                  <span className="auth-verify__to">{t("auth.verifyLead")}</span>
                  <strong
                    className="auth-verify__email"
                    title={pendingVerifyEmail}
                  >
                    {pendingVerifyEmail}
                  </strong>
                </div>
                <p className="auth-verify__hint">{t("auth.verifyHint")}</p>

                <button
                  type="button"
                  className="auth-cta"
                  onClick={() => {
                    setPendingVerifyEmail(null);
                    setMode("signin");
                  }}
                >
                  {t("auth.backToSignIn")}
                </button>

                {!addingAccount && (
                  <Link className="auth-note auth-note--link" to="/">
                    {t("auth.backHome")}
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <>
          <SegmentedControl<"signin" | "signup">
            className="auth-segment"
            shape="pill"
            aria-label={t("auth.signIn")}
            value={mode}
            onChange={(next) => {
              setMode(next);
              setShowPassword(false);
            }}
            options={[
              { value: "signin", label: t("auth.signIn") },
              { value: "signup", label: t("auth.signUp") },
            ]}
          />

          <form className="auth-form" data-mode={mode} onSubmit={onSubmit}>
            <div
              className={
                mode === "signup"
                  ? "auth-reveal is-open"
                  : "auth-reveal"
              }
              aria-hidden={mode !== "signup"}
            >
              <div className="auth-reveal__inner">
                <label className="auth-field">
                  <span>{t("auth.username")}</span>
                  <input
                    type="text"
                    placeholder={t("auth.usernamePlaceholder")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required={mode === "signup"}
                    disabled={mode !== "signup"}
                    tabIndex={mode === "signup" ? 0 : -1}
                    minLength={2}
                    maxLength={40}
                    autoComplete="username"
                  />
                </label>
              </div>
            </div>

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
            <div className="auth-field">
              <span id="auth-password-label">{t("auth.password")}</span>
              <div className="auth-password">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  aria-labelledby="auth-password-label"
                />
                <button
                  type="button"
                  className="auth-password__toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword
                      ? t("auth.hidePassword")
                      : t("auth.showPassword")
                  }
                  aria-pressed={showPassword}
                >
                  <EyeIcon open={!showPassword} />
                </button>
              </div>
            </div>

            <div
              className={
                mode === "signup"
                  ? "auth-reveal is-open"
                  : "auth-reveal"
              }
              aria-hidden={mode !== "signup"}
            >
              <div className="auth-reveal__inner">
                <div className="auth-password-strength" aria-live="polite">
                  <div className="auth-password-strength__header">
                    <span>{t("auth.passwordStrength")}</span>
                    <strong
                      className={`auth-password-strength__label auth-password-strength__label--${strength}`}
                    >
                      {t(`auth.passwordStrength_${strength}`)}
                    </strong>
                  </div>
                  <div
                    className="auth-password-strength__track"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={PASSWORD_RULES.length}
                    aria-valuenow={metCount}
                    aria-label={t("auth.passwordStrength")}
                  >
                    <div
                      className={`auth-password-strength__bar auth-password-strength__bar--${strength}`}
                      style={{
                        width: `${(metCount / PASSWORD_RULES.length) * 100}%`,
                      }}
                    />
                  </div>
                  <ul className="auth-password-rules">
                    {ruleStates.map((rule) => (
                      <li
                        key={rule.id}
                        className={
                          rule.met
                            ? "auth-password-rules__item is-met"
                            : "auth-password-rules__item"
                        }
                      >
                        <span className="auth-password-rules__mark" aria-hidden />
                        {t(rule.labelKey)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="auth-cta"
              disabled={busy || (mode === "signup" && !username.trim())}
            >
              {busy
                ? t("auth.pleaseWait")
                : mode === "signin"
                  ? addingAccount
                    ? t("auth.addAccount")
                    : t("auth.signIn")
                  : t("auth.createAccount")}
            </button>
          </form>

          <div className="auth-or">
            <span>{t("common.or")}</span>
          </div>

          <button
            type="button"
            className="auth-social auth-social--google"
            onClick={signInWithGoogle}
          >
            <span className="auth-social__icon" aria-hidden>
              <GoogleMark size={18} />
            </span>
            <span className="auth-social__label">{t("auth.continueGoogle")}</span>
          </button>

          {addingAccount && (
            <Link className="auth-note auth-note--link" to={APP_HOME_PATH}>
              {t("auth.cancelStay")}
            </Link>
          )}

          {!addingAccount && (
            <>
              <p className="auth-note">{t("auth.demoNote")}</p>
              <Link className="auth-note auth-note--link" to="/">
                {t("auth.backHome")}
              </Link>
            </>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;

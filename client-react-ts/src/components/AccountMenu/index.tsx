import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getLinkedProviders,
  linkGoogleIdentity,
  updateAccountAvatar,
  updateAccountEmail,
  updateAccountPassword,
  updateAccountUsername,
} from "../../lib/accountSettings";
import {
  avatarForAccount,
  isAccountSignedIn,
  type StoredAccount,
} from "../../lib/accountSessions";
import { APP_HOME_PATH } from "../../lib/sharing";
import type { AppUser } from "../../lib/user";
import GoogleMark from "../GoogleMark";

type AccountMenuProps = {
  user: AppUser;
  otherAccounts: StoredAccount[];
  busy: boolean;
  error: string | null;
  onBusy: (busy: boolean) => void;
  onError: (error: string | null) => void;
  onLogout: () => void;
  onLogoutAll: () => void;
  onSwitch: (account: StoredAccount) => void;
  onAddAccount: () => void;
  onRequestDeleteAccount: () => void;
};

type SettingsSection =
  | "username"
  | "email"
  | "password"
  | "avatar"
  | "login";

type SettingsRow = {
  id: SettingsSection;
  label: string;
  value: string;
};

function AccountMenu({
  user,
  otherAccounts,
  busy,
  error,
  onBusy,
  onError,
  onLogout,
  onLogoutAll,
  onSwitch,
  onAddAccount,
  onRequestDeleteAccount,
}: AccountMenuProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<"menu" | "settings">("menu");
  const [section, setSection] = useState<SettingsSection | null>(null);
  const [username, setUsername] = useState(user.username || user.displayName);
  const [email, setEmail] = useState(user.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasGoogle, setHasGoogle] = useState(false);
  const [hasEmail, setHasEmail] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState(avatarForAccount(user));
  const [menuHeight, setMenuHeight] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const skipHeightTransitionRef = useRef(true);

  useEffect(() => {
    setUsername(user.username || user.displayName);
    setEmail(user.email ?? "");
    setAvatarPreview(avatarForAccount(user));
  }, [user]);

  useEffect(() => {
    if (view !== "settings") return;
    let cancelled = false;
    getLinkedProviders()
      .then((linked) => {
        if (cancelled) return;
        setHasGoogle(linked.hasGoogle);
        setHasEmail(linked.hasEmail);
      })
      .catch(() => {
        /* optional until identities load */
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const body = bodyRef.current;
    if (!menu || !body) return;

    const applyHeight = (next: number) => {
      const maxHeight = Number.parseFloat(getComputedStyle(menu).maxHeight);
      const clamped =
        Number.isFinite(maxHeight) && maxHeight > 0
          ? Math.min(next, maxHeight)
          : next;
      setMenuHeight(clamped);
    };

    const measure = () => {
      const previous = menu.style.height;
      menu.style.height = "auto";
      const next = menu.getBoundingClientRect().height;
      menu.style.height = previous;

      if (skipHeightTransitionRef.current) {
        menu.classList.add("topbar__menu--no-size-transition");
        applyHeight(next);
        requestAnimationFrame(() => {
          skipHeightTransitionRef.current = false;
          menu.classList.remove("topbar__menu--no-size-transition");
        });
        return;
      }
      applyHeight(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [view, section, success, error, otherAccounts.length]);

  const openSettings = () => {
    onError(null);
    setSuccess(null);
    setSection(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setView("settings");
  };

  const backToMenu = () => {
    onError(null);
    setSuccess(null);
    setSection(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setView("menu");
  };

  const backToSettingsList = () => {
    onError(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setSection(null);
  };

  const openSection = (next: SettingsSection) => {
    onError(null);
    setSuccess(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setSection(next);
  };

  const runSave = async (action: () => Promise<void>, okMessage: string) => {
    onBusy(true);
    onError(null);
    setSuccess(null);
    try {
      await action();
      setSuccess(okMessage);
      setSection(null);
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "USERNAME_TOO_SHORT") {
        onError(t("accountSettings.usernameTooShort"));
      } else if (code === "EMAIL_INVALID") {
        onError(t("accountSettings.emailInvalid"));
      } else if (code === "PASSWORD_TOO_SHORT") {
        onError(t("accountSettings.passwordTooShort"));
      } else if (code === "PASSWORD_MISMATCH") {
        onError(t("accountSettings.passwordMismatch"));
      } else if (
        code === "AVATAR_NOT_IMAGE" ||
        code === "AVATAR_LOAD_FAILED" ||
        code === "AVATAR_COMPRESS_FAILED"
      ) {
        onError(t("accountSettings.avatarInvalid"));
      } else {
        onError(
          err instanceof Error ? err.message : t("accountSettings.saveFailed")
        );
      }
    } finally {
      onBusy(false);
    }
  };

  const onSaveUsername = () =>
    void runSave(async () => {
      await updateAccountUsername(username);
    }, t("accountSettings.usernameSaved"));

  const onSaveEmail = () =>
    void runSave(async () => {
      await updateAccountEmail(email);
    }, t("accountSettings.emailSaved"));

  const onSavePassword = () => {
    if (password !== confirmPassword) {
      onError(t("accountSettings.passwordMismatch"));
      return;
    }
    void runSave(async () => {
      await updateAccountPassword(password);
    }, t("accountSettings.passwordSaved"));
  };

  const onPickAvatar = (file: File | undefined) => {
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    void runSave(async () => {
      await updateAccountAvatar(file);
      URL.revokeObjectURL(localUrl);
    }, t("accountSettings.avatarSaved"));
  };

  const onLinkGoogle = async () => {
    onBusy(true);
    onError(null);
    setSuccess(null);
    try {
      await linkGoogleIdentity(`${window.location.origin}${APP_HOME_PATH}`);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : t("accountSettings.linkFailed")
      );
      onBusy(false);
    }
  };

  const loginMethodsValue = [
    hasEmail ? t("auth.email") : null,
    hasGoogle ? "Google" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const settingsRows: SettingsRow[] = [
    {
      id: "avatar",
      label: t("accountSettings.profilePhoto"),
      value: t("accountSettings.tapToUpdate"),
    },
    {
      id: "username",
      label: t("auth.username"),
      value: user.username || user.displayName,
    },
    {
      id: "email",
      label: t("auth.email"),
      value: user.email || t("common.noEmail"),
    },
    {
      id: "password",
      label: t("auth.password"),
      value: t("accountSettings.passwordMasked"),
    },
    {
      id: "login",
      label: t("accountSettings.loginMethods"),
      value: loginMethodsValue || t("accountSettings.notConnected"),
    },
  ];

  const sectionTitle =
    section === "avatar"
      ? t("accountSettings.profilePhoto")
      : section === "username"
        ? t("auth.username")
        : section === "email"
          ? t("auth.email")
          : section === "password"
            ? t("auth.password")
            : section === "login"
              ? t("accountSettings.loginMethods")
              : t("accountSettings.title");

  const settingsView = view === "settings";

  return (
    <div
      ref={menuRef}
      className={`topbar__menu${settingsView ? " topbar__menu--settings" : ""}`}
      role={settingsView ? "dialog" : "menu"}
      aria-label={settingsView ? t("accountSettings.title") : undefined}
      style={menuHeight != null ? { height: menuHeight } : undefined}
    >
      <div ref={bodyRef} className="topbar__menu-body">
        {settingsView ? (
          <>
            <div className="topbar__settings-head">
              <button
                type="button"
                className="topbar__settings-back"
                onClick={section ? backToSettingsList : backToMenu}
                disabled={busy}
              >
                ← {t("accountSettings.back")}
              </button>
              <div>
                <p className="topbar__menu-label">
                  {section
                    ? t("accountSettings.title")
                    : t("accountSettings.eyebrow")}
                </p>
                <h2 className="topbar__settings-title">{sectionTitle}</h2>
              </div>
            </div>

            {!section ? (
              <>
                <div className="topbar__settings-profile">
                  <img
                    src={avatarPreview}
                    alt=""
                    className="topbar__settings-avatar"
                  />
                  <div className="topbar__account-copy">
                    <p className="topbar__menu-name">{user.displayName}</p>
                    <p className="topbar__menu-meta">{user.email}</p>
                  </div>
                </div>

                <ul className="topbar__settings-list">
                  {settingsRows.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="topbar__settings-row"
                        disabled={busy}
                        onClick={() => openSection(row.id)}
                      >
                        <span className="topbar__settings-row-copy">
                          <span className="topbar__settings-row-label">
                            {row.label}
                          </span>
                          <span className="topbar__settings-row-value">
                            {row.value}
                          </span>
                        </span>
                        <span className="topbar__settings-chevron" aria-hidden>
                          ›
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="topbar__settings-detail">
                {section === "avatar" ? (
                  <>
                    <div className="topbar__settings-avatar-stage">
                      <img
                        src={avatarPreview}
                        alt=""
                        className="topbar__settings-avatar-large"
                      />
                    </div>
                    <p className="topbar__settings-hint">
                      {t("accountSettings.avatarHint")}
                    </p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="topbar__settings-file"
                      disabled={busy}
                      onChange={(event) => {
                        onPickAvatar(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      className="topbar__menu-logout"
                      disabled={busy}
                      onClick={() => fileRef.current?.click()}
                    >
                      {t("accountSettings.choosePhoto")}
                    </button>
                  </>
                ) : null}

                {section === "username" ? (
                  <>
                    <label className="topbar__settings-field">
                      <span>{t("auth.username")}</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        minLength={2}
                        maxLength={40}
                        autoComplete="username"
                        disabled={busy}
                        autoFocus
                      />
                    </label>
                    <button
                      type="button"
                      className="topbar__menu-logout"
                      disabled={busy || username.trim().length < 2}
                      onClick={onSaveUsername}
                    >
                      {t("common.save")}
                    </button>
                  </>
                ) : null}

                {section === "email" ? (
                  <>
                    <label className="topbar__settings-field">
                      <span>{t("auth.email")}</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        disabled={busy}
                        autoFocus
                      />
                    </label>
                    <p className="topbar__settings-hint">
                      {t("accountSettings.emailHint")}
                    </p>
                    <button
                      type="button"
                      className="topbar__menu-logout"
                      disabled={busy || !email.trim()}
                      onClick={onSaveEmail}
                    >
                      {t("common.save")}
                    </button>
                  </>
                ) : null}

                {section === "password" ? (
                  <>
                    <label className="topbar__settings-field">
                      <span>{t("accountSettings.newPassword")}</span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        minLength={8}
                        autoComplete="new-password"
                        disabled={busy}
                        autoFocus
                      />
                    </label>
                    <label className="topbar__settings-field">
                      <span>{t("accountSettings.confirmPassword")}</span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        minLength={8}
                        autoComplete="new-password"
                        disabled={busy}
                      />
                    </label>
                    <button
                      type="button"
                      className="topbar__settings-toggle"
                      onClick={() => setShowPassword((open) => !open)}
                    >
                      {showPassword
                        ? t("auth.hidePassword")
                        : t("auth.showPassword")}
                    </button>
                    <button
                      type="button"
                      className="topbar__menu-logout"
                      disabled={busy || password.length < 8}
                      onClick={onSavePassword}
                    >
                      {t("common.save")}
                    </button>
                  </>
                ) : null}

                {section === "login" ? (
                  <>
                    <div className="topbar__settings-providers">
                      <div className="topbar__settings-provider">
                        <span>{t("auth.email")}</span>
                        <span
                          className={
                            hasEmail
                              ? "topbar__account-status--in"
                              : "topbar__account-status--out"
                          }
                        >
                          {hasEmail
                            ? t("accountSettings.connected")
                            : t("accountSettings.notConnected")}
                        </span>
                      </div>
                      <div className="topbar__settings-provider">
                        <span className="topbar__settings-provider-label">
                          <GoogleMark size={16} />
                          Google
                        </span>
                        <span
                          className={
                            hasGoogle
                              ? "topbar__account-status--in"
                              : "topbar__account-status--out"
                          }
                        >
                          {hasGoogle
                            ? t("accountSettings.connected")
                            : t("accountSettings.notConnected")}
                        </span>
                      </div>
                    </div>
                    {!hasGoogle ? (
                      <button
                        type="button"
                        className="topbar__menu-secondary topbar__settings-google"
                        disabled={busy}
                        onClick={() => void onLinkGoogle()}
                      >
                        <GoogleMark size={16} />
                        {t("accountSettings.linkGoogle")}
                      </button>
                    ) : null}
                    <p className="topbar__settings-hint">
                      {t("accountSettings.loginHint")}
                    </p>
                  </>
                ) : null}
              </div>
            )}

            {success ? <p className="topbar__menu-success">{success}</p> : null}
            {error ? <p className="topbar__menu-error">{error}</p> : null}
          </>
        ) : (
          <>
            <p className="topbar__menu-label">{t("nav.currentAccount")}</p>
            <div className="topbar__account-row topbar__account-row--active">
              <button
                type="button"
                className="topbar__account-profile-btn"
                disabled={busy}
                onClick={openSettings}
                aria-label={t("accountSettings.open")}
              >
                <img
                  src={avatarForAccount(user)}
                  alt=""
                  className="topbar__account-avatar"
                />
                <span className="topbar__account-copy">
                  <span className="topbar__menu-name">{user.displayName}</span>
                  <span className="topbar__menu-meta">{user.email}</span>
                </span>
              </button>
              <button
                type="button"
                className="topbar__account-logout"
                disabled={busy}
                onClick={onLogout}
              >
                {t("nav.logOut")}
              </button>
            </div>

            {otherAccounts.length > 0 && (
              <>
                <p className="topbar__menu-label topbar__menu-label--spaced">
                  {t("nav.otherAccounts")}
                </p>
                <ul className="topbar__account-list">
                  {otherAccounts.map((account) => {
                    const signedIn = isAccountSignedIn(account);
                    return (
                      <li key={account.userId}>
                        <button
                          type="button"
                          className={`topbar__account-row ${
                            signedIn ? "" : "topbar__account-row--logged-out"
                          }`}
                          disabled={busy}
                          onClick={() => onSwitch(account)}
                        >
                          <img
                            src={avatarForAccount(account)}
                            alt=""
                            className="topbar__account-avatar"
                          />
                          <div className="topbar__account-copy">
                            <p className="topbar__menu-name">
                              {account.displayName}
                            </p>
                            <p className="topbar__menu-meta">{account.email}</p>
                          </div>
                          <span
                            className={`topbar__account-status ${
                              signedIn
                                ? "topbar__account-status--in"
                                : "topbar__account-status--out"
                            }`}
                          >
                            {signedIn ? t("nav.signedIn") : t("nav.loggedOut")}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <button
              type="button"
              className="topbar__menu-secondary"
              disabled={busy}
              onClick={openSettings}
            >
              {t("accountSettings.open")}
            </button>
            <button
              type="button"
              className="topbar__menu-secondary"
              disabled={busy}
              onClick={onAddAccount}
            >
              {t("nav.addAccount")}
            </button>
            <button
              type="button"
              className="topbar__menu-logout"
              disabled={busy}
              onClick={onLogoutAll}
            >
              {t("nav.logOutAll")}
            </button>
            <button
              type="button"
              className="topbar__menu-danger"
              disabled={busy}
              onClick={onRequestDeleteAccount}
            >
              {t("nav.deleteAccount")}
            </button>
            {error ? <p className="topbar__menu-error">{error}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}

export default AccountMenu;

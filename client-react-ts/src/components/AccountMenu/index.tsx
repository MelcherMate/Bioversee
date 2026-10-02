import { useEffect, useRef, useState } from "react";
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
  | "login"
  | null;

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
  const [section, setSection] = useState<SettingsSection>(null);
  const [username, setUsername] = useState(user.username || user.displayName);
  const [email, setEmail] = useState(user.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasGoogle, setHasGoogle] = useState(false);
  const [hasEmail, setHasEmail] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState(
    avatarForAccount(user)
  );
  const fileRef = useRef<HTMLInputElement | null>(null);

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

  const openSettings = () => {
    onError(null);
    setSuccess(null);
    setSection(null);
    setPassword("");
    setConfirmPassword("");
    setView("settings");
  };

  const backToMenu = () => {
    onError(null);
    setSuccess(null);
    setSection(null);
    setPassword("");
    setConfirmPassword("");
    setView("menu");
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
      await linkGoogleIdentity(
        `${window.location.origin}${APP_HOME_PATH}`
      );
    } catch (err) {
      onError(
        err instanceof Error ? err.message : t("accountSettings.linkFailed")
      );
      onBusy(false);
    }
  };

  if (view === "settings") {
    return (
      <div
        className="topbar__menu topbar__menu--settings"
        role="dialog"
        aria-label={t("accountSettings.title")}
      >
        <div className="topbar__settings-head">
          <button
            type="button"
            className="topbar__settings-back"
            onClick={backToMenu}
            disabled={busy}
          >
            ← {t("accountSettings.back")}
          </button>
          <div>
            <p className="topbar__menu-label">{t("accountSettings.eyebrow")}</p>
            <h2 className="topbar__settings-title">
              {t("accountSettings.title")}
            </h2>
          </div>
        </div>

        <div className="topbar__settings-profile">
          <img src={avatarPreview} alt="" className="topbar__settings-avatar" />
          <div className="topbar__account-copy">
            <p className="topbar__menu-name">{user.displayName}</p>
            <p className="topbar__menu-meta">{user.email}</p>
          </div>
        </div>

        <ul className="topbar__settings-list">
          <li>
            <button
              type="button"
              className={`topbar__settings-item${
                section === "avatar" ? " is-open" : ""
              }`}
              disabled={busy}
              onClick={() =>
                setSection((current) => (current === "avatar" ? null : "avatar"))
              }
            >
              <span>{t("accountSettings.changeAvatar")}</span>
              <span className="topbar__settings-chevron" aria-hidden>
                {section === "avatar" ? "−" : "+"}
              </span>
            </button>
            {section === "avatar" && (
              <div className="topbar__settings-panel">
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
                  className="topbar__menu-secondary"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {t("accountSettings.choosePhoto")}
                </button>
              </div>
            )}
          </li>

          <li>
            <button
              type="button"
              className={`topbar__settings-item${
                section === "username" ? " is-open" : ""
              }`}
              disabled={busy}
              onClick={() =>
                setSection((current) =>
                  current === "username" ? null : "username"
                )
              }
            >
              <span>{t("accountSettings.changeUsername")}</span>
              <span className="topbar__settings-chevron" aria-hidden>
                {section === "username" ? "−" : "+"}
              </span>
            </button>
            {section === "username" && (
              <div className="topbar__settings-panel">
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
              </div>
            )}
          </li>

          <li>
            <button
              type="button"
              className={`topbar__settings-item${
                section === "email" ? " is-open" : ""
              }`}
              disabled={busy}
              onClick={() =>
                setSection((current) => (current === "email" ? null : "email"))
              }
            >
              <span>{t("accountSettings.changeEmail")}</span>
              <span className="topbar__settings-chevron" aria-hidden>
                {section === "email" ? "−" : "+"}
              </span>
            </button>
            {section === "email" && (
              <div className="topbar__settings-panel">
                <label className="topbar__settings-field">
                  <span>{t("auth.email")}</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    disabled={busy}
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
              </div>
            )}
          </li>

          <li>
            <button
              type="button"
              className={`topbar__settings-item${
                section === "password" ? " is-open" : ""
              }`}
              disabled={busy}
              onClick={() =>
                setSection((current) =>
                  current === "password" ? null : "password"
                )
              }
            >
              <span>{t("accountSettings.changePassword")}</span>
              <span className="topbar__settings-chevron" aria-hidden>
                {section === "password" ? "−" : "+"}
              </span>
            </button>
            {section === "password" && (
              <div className="topbar__settings-panel">
                <label className="topbar__settings-field">
                  <span>{t("accountSettings.newPassword")}</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    disabled={busy}
                  />
                </label>
                <label className="topbar__settings-field">
                  <span>{t("accountSettings.confirmPassword")}</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
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
              </div>
            )}
          </li>

          <li>
            <button
              type="button"
              className={`topbar__settings-item${
                section === "login" ? " is-open" : ""
              }`}
              disabled={busy}
              onClick={() =>
                setSection((current) => (current === "login" ? null : "login"))
              }
            >
              <span>{t("accountSettings.loginMethods")}</span>
              <span className="topbar__settings-chevron" aria-hidden>
                {section === "login" ? "−" : "+"}
              </span>
            </button>
            {section === "login" && (
              <div className="topbar__settings-panel">
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
                {!hasGoogle && (
                  <button
                    type="button"
                    className="topbar__menu-secondary topbar__settings-google"
                    disabled={busy}
                    onClick={() => void onLinkGoogle()}
                  >
                    <GoogleMark size={16} />
                    {t("accountSettings.linkGoogle")}
                  </button>
                )}
                <p className="topbar__settings-hint">
                  {t("accountSettings.loginHint")}
                </p>
              </div>
            )}
          </li>
        </ul>

        {success && <p className="topbar__menu-success">{success}</p>}
        {error && <p className="topbar__menu-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="topbar__menu" role="menu">
      <p className="topbar__menu-label">{t("nav.currentAccount")}</p>
      <div className="topbar__account-row topbar__account-row--active">
        <img
          src={avatarForAccount(user)}
          alt=""
          className="topbar__account-avatar"
        />
        <div className="topbar__account-copy">
          <p className="topbar__menu-name">{user.displayName}</p>
          <p className="topbar__menu-meta">{user.email}</p>
        </div>
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
                      <p className="topbar__menu-name">{account.displayName}</p>
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
      {error && <p className="topbar__menu-error">{error}</p>}
    </div>
  );
}

export default AccountMenu;

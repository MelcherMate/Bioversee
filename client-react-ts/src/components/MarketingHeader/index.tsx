import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  avatarForAccount,
  deleteCurrentAccount,
  listStoredAccounts,
  signOutAllAccounts,
  signOutCurrentAccount,
  switchToAccount,
  type StoredAccount,
} from "../../lib/accountSessions";
import { LANGUAGE_OPTIONS, type AppLanguage } from "../../lib/appearance";
import { useAppearance } from "../../lib/AppearanceProvider";
import { APP_HOME_PATH } from "../../lib/sharing";
import type { AppUser } from "../../lib/user";
import Logo from "../../utils/svgs/new_logo.svg";
import AccountMenu from "../AccountMenu";
import "../Navbar/Navbar.css";
import "./MarketingHeader.css";

type MarketingHeaderProps = {
  user?: AppUser | null;
};

function MarketingHeader({ user = null }: MarketingHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, setLanguage } = useAppearance();
  const [showAccount, setShowAccount] = useState(false);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    setAccounts(listStoredAccounts());
  }, [user]);

  useEffect(() => {
    if (!showAccount) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setShowAccount(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showAccount]);

  const otherAccounts = accounts.filter((account) => account.userId !== user?.id);

  const onLogout = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOutCurrentAccount();
      setShowAccount(false);
    } catch {
      setError(t("nav.couldNotLogOut"));
    } finally {
      setBusy(false);
    }
  };

  const onLogoutAll = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOutAllAccounts();
      setShowAccount(false);
    } catch {
      setError(t("nav.couldNotLogOut"));
    } finally {
      setBusy(false);
    }
  };

  const onSwitch = async (account: StoredAccount) => {
    setBusy(true);
    setError(null);
    try {
      await switchToAccount(account.userId);
      setShowAccount(false);
      setAccounts(listStoredAccounts());
    } catch {
      setError(t("nav.couldNotSwitch"));
    } finally {
      setBusy(false);
    }
  };

  const onAddAccount = () => {
    setShowAccount(false);
    navigate("/add-account");
  };

  const onDeleteAccount = async () => {
    if (!window.confirm(t("nav.deleteAccountConfirmBody"))) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCurrentAccount(false);
      setShowAccount(false);
    } catch {
      setError(t("nav.couldNotDeleteAccount"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="mkt-header">
      <div className="mkt-header__start">
        <Link to="/about" className="mkt-header__brand">
          <span className="mkt-header__mark" aria-hidden="true">
            <img src={Logo} alt="" width={28} height={28} />
          </span>
          <span className="mkt-header__name">{t("common.brand")}</span>
        </Link>
        {user && (
          <Link to={APP_HOME_PATH} className="mkt-header__back">
            {t("landing.backToControls")}
          </Link>
        )}
      </div>

      <div className="mkt-header__actions">
        {!user && (
          <>
            <label className="mkt-header__lang">
              <span className="mkt-header__lang-label">
                {t("appearance.language")}
              </span>
              <select
                className="mkt-header__lang-select"
                value={settings.language}
                aria-label={t("appearance.language")}
                onChange={(event) =>
                  setLanguage(event.target.value as AppLanguage)
                }
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <Link to="/login" className="mkt-header__signin">
              {t("auth.signIn")}
            </Link>
          </>
        )}

        {user && (
          <div className="topbar__account mkt-header__account" ref={accountRef}>
            <button
              type="button"
              className="topbar__avatar-btn"
              aria-label={t("nav.accountMenu")}
              aria-expanded={showAccount}
              onClick={() => setShowAccount((open) => !open)}
            >
              <img
                src={avatarForAccount(user)}
                alt=""
                className="topbar__avatar"
              />
            </button>
            {showAccount && (
              <AccountMenu
                user={user}
                otherAccounts={otherAccounts}
                busy={busy}
                error={error}
                onBusy={setBusy}
                onError={setError}
                onLogout={() => void onLogout()}
                onLogoutAll={() => void onLogoutAll()}
                onSwitch={(account) => void onSwitch(account)}
                onAddAccount={onAddAccount}
                onRequestDeleteAccount={() => void onDeleteAccount()}
              />
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default MarketingHeader;

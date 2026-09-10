import { useEffect, useRef, useState } from "react";
import { ShareSocialOutline } from "react-ionicons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  avatarForAccount,
  listStoredAccounts,
  signOutAllAccounts,
  signOutCurrentAccount,
  switchToAccount,
  upsertStoredSession,
  type StoredAccount,
} from "../../lib/accountSessions";
import type { AppUser } from "../../lib/user";
import { supabase } from "../../lib/supabase";
import SharePanel from "../SharePanel";
import "./Navbar.css";

type NavbarProps = {
  user: AppUser;
};

const Navbar = ({ user }: NavbarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showAccount, setShowAccount] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accountRef = useRef<HTMLDivElement | null>(null);

  const refreshAccounts = () => {
    setAccounts(listStoredAccounts());
  };

  useEffect(() => {
    refreshAccounts();
  }, [user.id, showAccount]);

  useEffect(() => {
    setShowShare(false);
    setShowAccount(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountRef.current &&
        event.target instanceof Node &&
        !accountRef.current.contains(event.target)
      ) {
        setShowAccount(false);
      }
    };

    if (showAccount) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAccount]);

  const otherAccounts = accounts.filter((account) => account.userId !== user.id);

  const onSwitch = async (userId: string) => {
    if (busy || userId === user.id) return;
    setBusy(true);
    setError(null);
    try {
      await switchToAccount(userId);
      setShowAccount(false);
      navigate("/bioreactor", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch account");
      refreshAccounts();
    } finally {
      setBusy(false);
    }
  };

  const onAddAccount = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      upsertStoredSession(data.session);
    }
    setShowAccount(false);
    navigate("/add-account");
  };

  const onLogout = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOutCurrentAccount();
      setShowAccount(false);
      if (listStoredAccounts().length === 0) {
        navigate("/", { replace: true });
      } else {
        navigate("/bioreactor", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log out");
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
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log out");
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="topbar__left">
          <Link to="/bioreactor" className="topbar__brand">
            <span className="topbar__mark" aria-hidden />
            Bioversee
          </Link>
          <nav className="topbar__nav">
            <Link
              className={`topbar__link ${
                location.pathname === "/bioreactor" ? "is-active" : ""
              }`}
              to="/bioreactor"
            >
              Bioreactor
              <span className="topbar__badge topbar__badge--legacy">Legacy</span>
            </Link>
            <Link
              className={`topbar__link ${
                location.pathname === "/pressure-vessel" ? "is-active" : ""
              }`}
              to="/pressure-vessel"
            >
              Pressure Vessel
            </Link>
            <Link
              className={`topbar__link ${
                location.pathname === "/membrane-bioreactor" ? "is-active" : ""
              }`}
              to="/membrane-bioreactor"
            >
              Membrane MBR
            </Link>
            <Link
              className={`topbar__link ${
                location.pathname === "/waterpurifier" ? "is-active" : ""
              }`}
              to="/waterpurifier"
            >
              Water Purifier
              <span className="topbar__badge topbar__badge--legacy">Legacy</span>
            </Link>
          </nav>
        </div>

        <div className="topbar__right">
          <div className="topbar__share-wrap">
            <button
              type="button"
              className={`topbar__icon-btn ${showShare ? "is-active" : ""}`}
              aria-label="Share"
              aria-expanded={showShare}
              onClick={() => {
                setShowAccount(false);
                setShowShare((open) => !open);
              }}
            >
              <ShareSocialOutline
                color={"#1d1d1f"}
                title={"Share"}
                height="20px"
                width="20px"
              />
            </button>
            <SharePanel
              user={user}
              open={showShare}
              onClose={() => setShowShare(false)}
            />
          </div>
          <div className="topbar__account" ref={accountRef}>
            <button
              type="button"
              className="topbar__avatar-btn"
              onClick={() => {
                setShowShare(false);
                setShowAccount((open) => !open);
              }}
            >
              <img
                src={avatarForAccount(user)}
                alt=""
                className="topbar__avatar"
              />
            </button>
            {showAccount && (
              <div className="topbar__menu">
                <p className="topbar__menu-label">Signed in</p>
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
                  <span className="topbar__account-check" aria-hidden>
                    ✓
                  </span>
                </div>

                {otherAccounts.length > 0 && (
                  <>
                    <p className="topbar__menu-label topbar__menu-label--spaced">
                      Switch account
                    </p>
                    <ul className="topbar__account-list">
                      {otherAccounts.map((account) => (
                        <li key={account.userId}>
                          <button
                            type="button"
                            className="topbar__account-row"
                            disabled={busy}
                            onClick={() => onSwitch(account.userId)}
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
                              <p className="topbar__menu-meta">
                                {account.email}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <button
                  type="button"
                  className="topbar__menu-secondary"
                  disabled={busy}
                  onClick={onAddAccount}
                >
                  Add account
                </button>
                <button
                  type="button"
                  className="topbar__menu-logout"
                  disabled={busy}
                  onClick={onLogout}
                >
                  {otherAccounts.length > 0 ? "Log out of this account" : "Log out"}
                </button>
                {accounts.length > 1 && (
                  <button
                    type="button"
                    className="topbar__menu-text"
                    disabled={busy}
                    onClick={onLogoutAll}
                  >
                    Log out of all accounts
                  </button>
                )}
                {error && <p className="topbar__menu-error">{error}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

import { useEffect, useRef, useState } from "react";
import { ChevronDownOutline, ShareSocialOutline } from "react-ionicons";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  avatarForAccount,
  isAccountSignedIn,
  listStoredAccounts,
  signOutAllAccounts,
  signOutCurrentAccount,
  switchToAccount,
  upsertStoredSession,
  type StoredAccount,
} from "../../lib/accountSessions";
import {
  connectivityLabel,
  useAppStatus,
} from "../../lib/appStatus";
import {
  isLegacyDeviceType,
  listAccessibleDevices,
  type Device,
  type DeviceType,
} from "../../lib/devices";
import {
  deviceTypeFromPath,
  openSharedDeviceUrl,
  pathForDeviceType,
} from "../../lib/sharing";
import type { AppUser } from "../../lib/user";
import { supabase } from "../../lib/supabase";
import SharePanel from "../SharePanel";
import "./Navbar.css";

type AccessibleDevice = Device & { role: string; isOwner: boolean };

type NavbarProps = {
  user: AppUser;
};

function deviceHref(device: Pick<Device, "id" | "type" | "owner_id">, userId: string) {
  if (device.owner_id === userId) {
    return pathForDeviceType(device.type);
  }
  return openSharedDeviceUrl(device);
}

const Navbar = ({ user }: NavbarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { connectivity, issue } = useAppStatus();

  const [showAccount, setShowAccount] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [devices, setDevices] = useState<AccessibleDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountRef = useRef<HTMLDivElement | null>(null);
  const deviceRef = useRef<HTMLDivElement | null>(null);

  const preferredDeviceId = searchParams.get("device");
  const routeType = deviceTypeFromPath(location.pathname);

  const refreshAccounts = () => setAccounts(listStoredAccounts());

  useEffect(() => {
    refreshAccounts();
  }, [user.id, showAccount]);

  useEffect(() => {
    let cancelled = false;
    setDevicesLoading(true);
    listAccessibleDevices()
      .then((list) => {
        if (!cancelled) setDevices(list);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setDevices([]);
      })
      .finally(() => {
        if (!cancelled) setDevicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    setShowShare(false);
    setShowAccount(false);
    setShowDevices(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountRef.current &&
        event.target instanceof Node &&
        !accountRef.current.contains(event.target)
      ) {
        setShowAccount(false);
      }
      if (
        deviceRef.current &&
        event.target instanceof Node &&
        !deviceRef.current.contains(event.target)
      ) {
        setShowDevices(false);
      }
    };

    if (showAccount || showDevices) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAccount, showDevices]);

  const ownedDevices = devices.filter((device) => device.isOwner);
  const sharedDevices = devices.filter((device) => !device.isOwner);

  const activeDevice =
    (preferredDeviceId &&
      devices.find((device) => device.id === preferredDeviceId)) ||
    (routeType &&
      ownedDevices.find((device) => device.type === routeType)) ||
    (routeType && devices.find((device) => device.type === routeType)) ||
    null;

  const otherAccounts = accounts.filter((account) => account.userId !== user.id);

  const statusTitle = issue
    ? `${connectivityLabel(connectivity)}: ${issue}`
    : connectivityLabel(connectivity);

  const onSelectDevice = (device: AccessibleDevice) => {
    setShowDevices(false);
    navigate(deviceHref(device, user.id));
  };

  const onSwitch = async (account: StoredAccount) => {
    if (busy || account.userId === user.id) return;

    if (!isAccountSignedIn(account)) {
      setShowAccount(false);
      navigate(
        `/add-account?email=${encodeURIComponent(account.email ?? "")}`
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await switchToAccount(account.userId);
      setShowAccount(false);
      navigate("/bioreactor", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "REAUTH_REQUIRED") {
        setShowAccount(false);
        navigate(
          `/add-account?email=${encodeURIComponent(account.email ?? "")}`
        );
        return;
      }
      setError(message || "Could not switch account");
      refreshAccounts();
    } finally {
      setBusy(false);
    }
  };

  const onAddAccount = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      upsertStoredSession(data.session, { resetSignedInAt: false });
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
      if (!listStoredAccounts().some(isAccountSignedIn)) {
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
          <Link
            to="/bioreactor"
            className="topbar__brand"
            title={statusTitle}
          >
            <span
              className={`topbar__mark topbar__mark--${connectivity}`}
              aria-hidden
            />
            <span className="topbar__brand-text">Bioversee</span>
            <span className="topbar__sr-only">{statusTitle}</span>
          </Link>

          <div className="topbar__device" ref={deviceRef}>
            <button
              type="button"
              className={`topbar__device-btn ${showDevices ? "is-open" : ""}`}
              aria-expanded={showDevices}
              aria-haspopup="listbox"
              onClick={() => {
                setShowAccount(false);
                setShowShare(false);
                setShowDevices((open) => !open);
              }}
            >
              <span className="topbar__device-copy">
                <span className="topbar__device-label">Device</span>
                <span className="topbar__device-name">
                  {devicesLoading
                    ? "Loading…"
                    : activeDevice?.name ??
                      labelForType(routeType) ??
                      "Select device"}
                </span>
              </span>
              {activeDevice && isLegacyDeviceType(activeDevice.type) && (
                <span className="topbar__pill topbar__pill--legacy">Legacy</span>
              )}
              {!activeDevice?.isOwner && activeDevice && (
                <span className="topbar__pill">Shared</span>
              )}
              <ChevronDownOutline
                color="#6e6e73"
                height="16px"
                width="16px"
                title=""
              />
            </button>

            {showDevices && (
              <div className="topbar__device-menu" role="listbox">
                <p className="topbar__menu-label">Your devices</p>
                {ownedDevices.length === 0 ? (
                  <p className="topbar__device-empty">No devices yet</p>
                ) : (
                  <ul className="topbar__device-list">
                    {ownedDevices.map((device) => (
                      <li key={device.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={activeDevice?.id === device.id}
                          className={`topbar__device-option ${
                            activeDevice?.id === device.id ? "is-active" : ""
                          }`}
                          onClick={() => onSelectDevice(device)}
                        >
                          <span>
                            <span className="topbar__device-option-name">
                              {device.name}
                            </span>
                            <span className="topbar__device-option-meta">
                              {labelForType(device.type)}
                            </span>
                          </span>
                          {isLegacyDeviceType(device.type) && (
                            <span className="topbar__pill topbar__pill--legacy">
                              Legacy
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {sharedDevices.length > 0 && (
                  <>
                    <p className="topbar__menu-label topbar__menu-label--spaced">
                      Shared with you
                    </p>
                    <ul className="topbar__device-list">
                      {sharedDevices.map((device) => (
                        <li key={device.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={activeDevice?.id === device.id}
                            className={`topbar__device-option ${
                              activeDevice?.id === device.id ? "is-active" : ""
                            }`}
                            onClick={() => onSelectDevice(device)}
                          >
                            <span>
                              <span className="topbar__device-option-name">
                                {device.name}
                              </span>
                              <span className="topbar__device-option-meta">
                                {labelForType(device.type)} · {device.role}
                              </span>
                            </span>
                            <span className="topbar__pill">Shared</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
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
                setShowDevices(false);
                setShowShare((open) => !open);
              }}
            >
              <ShareSocialOutline
                color="#1d1d1f"
                title="Share"
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
              aria-label="Account menu"
              onClick={() => {
                setShowShare(false);
                setShowDevices(false);
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
                <p className="topbar__menu-label">Current account</p>
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
                  <span className="topbar__account-status topbar__account-status--in">
                    Signed in
                  </span>
                </div>

                {otherAccounts.length > 0 && (
                  <>
                    <p className="topbar__menu-label topbar__menu-label--spaced">
                      Other accounts
                    </p>
                    <ul className="topbar__account-list">
                      {otherAccounts.map((account) => {
                        const signedIn = isAccountSignedIn(account);
                        return (
                          <li key={account.userId}>
                            <button
                              type="button"
                              className={`topbar__account-row ${
                                signedIn
                                  ? ""
                                  : "topbar__account-row--logged-out"
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
                                <p className="topbar__menu-meta">
                                  {account.email}
                                </p>
                              </div>
                              <span
                                className={`topbar__account-status ${
                                  signedIn
                                    ? "topbar__account-status--in"
                                    : "topbar__account-status--out"
                                }`}
                              >
                                {signedIn ? "Signed in" : "Logged out"}
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
                  {otherAccounts.length > 0
                    ? "Log out of this account"
                    : "Log out"}
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

function labelForType(type: DeviceType | null | undefined): string | null {
  switch (type) {
    case "bioreactor":
      return "Bioreactor";
    case "pressure_vessel":
      return "Pressure Vessel";
    case "membrane_bioreactor":
      return "Membrane MBR";
    case "water_purifier":
      return "Water Purifier";
    default:
      return null;
  }
}

export default Navbar;

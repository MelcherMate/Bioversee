import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  AddOutline,
  NotificationsOutline,
  ShareSocialOutline,
} from "react-ionicons";
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
import { connectivityLabel, useAppStatus } from "../../lib/appStatus";
import { DEVICE_TYPE_META } from "../../lib/deviceIcons";
import {
  deleteMyDevice,
  leaveDevice,
  listAccessibleDevices,
  ownerAvatarSrc,
  type AccessibleDevice,
  type Device,
  type DeviceType,
} from "../../lib/devices";
import { listMyNotifications, unreadCount } from "../../lib/notifications";
import { pathForDeviceType, deviceTypeFromPath } from "../../lib/sharing";
import type { AppUser } from "../../lib/user";
import { supabase } from "../../lib/supabase";
import AddDevicePanel from "../AddDevicePanel";
import DeviceContextMenu from "../DeviceContextMenu";
import DeviceSettingsPanel from "../DeviceSettingsPanel";
import NotificationsPanel from "../NotificationsPanel";
import SharePanel from "../SharePanel";
import "./Navbar.css";

type NavbarProps = {
  user: AppUser;
};

function deviceHref(device: Pick<Device, "id" | "type">) {
  return `${pathForDeviceType(device.type)}?device=${device.id}`;
}

const Navbar = ({ user }: NavbarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { connectivity, issue } = useAppStatus();

  const [showAccount, setShowAccount] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [settingsDevice, setSettingsDevice] =
    useState<AccessibleDevice | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    device: AccessibleDevice;
    x: number;
    y: number;
  } | null>(null);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [devices, setDevices] = useState<AccessibleDevice[]>([]);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountRef = useRef<HTMLDivElement | null>(null);
  const addRef = useRef<HTMLDivElement | null>(null);
  const devicesRef = useRef<HTMLDivElement | null>(null);

  const preferredDeviceId = searchParams.get("device");
  const routeType = deviceTypeFromPath(location.pathname);

  const refreshAccounts = () => setAccounts(listStoredAccounts());

  const refreshDevices = useCallback(() => {
    return listAccessibleDevices()
      .then(setDevices)
      .catch((err) => {
        console.error(err);
        setDevices([]);
      });
  }, []);

  useEffect(() => {
    refreshAccounts();
  }, [user.id, showAccount]);

  useEffect(() => {
    void refreshDevices();
  }, [user.id, refreshDevices]);

  useEffect(() => {
    let cancelled = false;
    const pullUnread = () => {
      listMyNotifications(20)
        .then((list) => {
          if (!cancelled) setUnread(unreadCount(list));
        })
        .catch(() => {
          /* optional until SQL applied */
        });
    };
    pullUnread();
    const interval = window.setInterval(pullUnread, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user.id]);

  useEffect(() => {
    setShowShare(false);
    setShowAccount(false);
    setShowAddDevice(false);
    setShowNotifications(false);
    setContextMenu(null);
    setSettingsDevice(null);
  }, [location.pathname, location.search]);

  const closeOverlays = () => {
    setShowAccount(false);
    setShowShare(false);
    setShowAddDevice(false);
    setShowNotifications(false);
    setContextMenu(null);
  };

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

  const activeDevice =
    (preferredDeviceId &&
      devices.find((device) => device.id === preferredDeviceId)) ||
    (routeType &&
      devices.find((device) => device.type === routeType && device.isOwner)) ||
    (routeType && devices.find((device) => device.type === routeType)) ||
    null;

  const otherAccounts = accounts.filter((account) => account.userId !== user.id);

  const statusTitle = issue
    ? `${connectivityLabel(connectivity)}: ${issue}`
    : connectivityLabel(connectivity);

  const onSelectDevice = (device: AccessibleDevice) => {
    closeOverlays();
    setSettingsDevice(null);
    navigate(deviceHref(device));
  };

  const onDeviceCreated = async (deviceId: string, type: DeviceType) => {
    await refreshDevices();
    navigate(`${pathForDeviceType(type)}?device=${deviceId}`);
  };

  const onDeviceContextMenu = (
    event: ReactMouseEvent,
    device: AccessibleDevice
  ) => {
    event.preventDefault();
    event.stopPropagation();
    closeOverlays();
    setSettingsDevice(null);
    setContextMenu({ device, x: event.clientX, y: event.clientY });
  };

  const onDeleteDevice = async (device: AccessibleDevice) => {
    const ok = window.confirm(
      `Delete “${device.name}”? This removes its data for everyone.`
    );
    if (!ok) return;
    try {
      await deleteMyDevice(device.id);
      setSettingsDevice(null);
      await refreshDevices();
      if (preferredDeviceId === device.id || activeDevice?.id === device.id) {
        navigate("/bioreactor", { replace: true });
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete");
    }
  };

  const onLeaveDevice = async (device: AccessibleDevice) => {
    const ok = window.confirm(`Leave “${device.name}? You can be re-invited later.`);
    if (!ok) return;
    try {
      await leaveDevice(device.id);
      setSettingsDevice(null);
      await refreshDevices();
      if (preferredDeviceId === device.id) {
        navigate("/bioreactor", { replace: true });
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not leave");
    }
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
          <Link to="/bioreactor" className="topbar__brand" title={statusTitle}>
            <span
              className={`topbar__mark topbar__mark--${connectivity}`}
              aria-hidden
            />
            <span className="topbar__brand-text">Bioversee</span>
            <span className="topbar__sr-only">{statusTitle}</span>
          </Link>

          <div className="topbar__add" ref={addRef}>
            <button
              type="button"
              className={`topbar__round-btn topbar__add-btn ${
                showAddDevice ? "is-active" : ""
              }`}
              aria-label="Add device"
              aria-expanded={showAddDevice}
              title="Add device"
              onClick={() => {
                setShowAccount(false);
                setShowShare(false);
                setShowNotifications(false);
                setShowAddDevice((open) => !open);
              }}
            >
              <AddOutline color="#0f766e" height="18px" width="18px" title="" />
            </button>
            <AddDevicePanel
              open={showAddDevice}
              onClose={() => setShowAddDevice(false)}
              onCreated={onDeviceCreated}
            />
          </div>

          <div className="topbar__devices" ref={devicesRef} role="toolbar" aria-label="Devices">
            {devices.map((device) => {
              const meta = DEVICE_TYPE_META[device.type];
              const Icon = meta.Icon;
              const active = activeDevice?.id === device.id;
              return (
                <button
                  key={device.id}
                  type="button"
                  className={`topbar__device-icon ${active ? "is-active" : ""} ${
                    device.isOwner ? "" : "is-shared"
                  }`}
                  title={device.name}
                  aria-label={device.name}
                  aria-pressed={active}
                  onClick={() => onSelectDevice(device)}
                  onContextMenu={(event) => onDeviceContextMenu(event, device)}
                >
                  <Icon
                    color={active ? "#0f766e" : "#1d1d1f"}
                    height="18px"
                    width="18px"
                    title={device.name}
                  />
                  {!device.isOwner && (
                    <span
                      className="topbar__device-owner"
                      title={
                        device.ownerDisplayName
                          ? `Shared by ${device.ownerDisplayName}`
                          : "Shared device"
                      }
                    >
                      <img src={ownerAvatarSrc(device)} alt="" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="topbar__settings-anchor">
            <DeviceSettingsPanel
              device={settingsDevice}
              open={Boolean(settingsDevice)}
              onClose={() => setSettingsDevice(null)}
              onRenamed={() => {
                void refreshDevices();
              }}
              onRequestDelete={(device) => {
                void onDeleteDevice(device);
              }}
            />
          </div>
        </div>

        {contextMenu && (
          <DeviceContextMenu
            device={contextMenu.device}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onSettings={(device) => setSettingsDevice(device)}
            onDelete={(device) => {
              void onDeleteDevice(device);
            }}
            onLeave={(device) => {
              void onLeaveDevice(device);
            }}
          />
        )}

        <div className="topbar__right">
          <div className="topbar__share-wrap">
            <button
              type="button"
              className={`topbar__icon-btn ${showShare ? "is-active" : ""}`}
              aria-label="Share"
              aria-expanded={showShare}
              onClick={() => {
                setShowAccount(false);
                setShowAddDevice(false);
                setShowNotifications(false);
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
              onDevicesChanged={refreshDevices}
            />
          </div>

          <div className="topbar__notif-wrap">
            <button
              type="button"
              className={`topbar__icon-btn ${showNotifications ? "is-active" : ""}`}
              aria-label={
                unread > 0
                  ? `Notifications, ${unread} unread`
                  : "Notifications"
              }
              aria-expanded={showNotifications}
              onClick={() => {
                setShowAccount(false);
                setShowAddDevice(false);
                setShowShare(false);
                setShowNotifications((open) => !open);
              }}
            >
              <NotificationsOutline
                color="#1d1d1f"
                title="Notifications"
                height="20px"
                width="20px"
              />
              {unread > 0 ? (
                <span className="topbar__badge-dot" aria-hidden="true">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </button>
            <NotificationsPanel
              open={showNotifications}
              onClose={() => setShowNotifications(false)}
              onUnreadChange={setUnread}
              onDevicesChanged={refreshDevices}
            />
          </div>

          <div className="topbar__account" ref={accountRef}>
            <button
              type="button"
              className="topbar__avatar-btn"
              aria-label="Account menu"
              onClick={() => {
                setShowShare(false);
                setShowAddDevice(false);
                setShowNotifications(false);
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

export default Navbar;

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  AddOutline,
  NotificationsOutline,
  SettingsOutline,
} from "react-ionicons";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  avatarForAccount,
  deleteCurrentAccount,
  isAccountSignedIn,
  listStoredAccounts,
  signOutAllAccounts,
  signOutCurrentAccount,
  switchToAccount,
  upsertStoredSession,
  type StoredAccount,
} from "../../lib/accountSessions";
import { connectivityLabel, useAppStatus } from "../../lib/appStatus";
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
import { subscribeMyNotifications } from "../../lib/notificationsSync";
import { subscribeMyDevices } from "../../lib/devicesSync";
import { pathForDeviceType, deviceTypeFromPath, fallbackPathAfterLostDevice } from "../../lib/sharing";
import { DEVICES_CHANGED_EVENT, OPEN_ADD_DEVICE_EVENT } from "../../lib/onboarding";
import type { AppUser } from "../../lib/user";
import { supabase } from "../../lib/supabase";
import AddDevicePanel from "../AddDevicePanel";
import AppSettingsPanel from "../AppSettingsPanel";
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
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { connectivity, issue } = useAppStatus();

  const [showAccount, setShowAccount] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [shareDevice, setShareDevice] = useState<AccessibleDevice | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [addDeviceDefaultType, setAddDeviceDefaultType] =
    useState<DeviceType>("bioreactor");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [settingsDevice, setSettingsDevice] =
    useState<AccessibleDevice | null>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
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
      .then((next) => {
        setDevices(next);
        const preferred = searchParams.get("device");
        if (preferred && !next.some((device) => device.id === preferred)) {
          navigate(
            fallbackPathAfterLostDevice(
              next,
              deviceTypeFromPath(location.pathname)
            ),
            { replace: true }
          );
        }
      })
      .catch((err) => {
        console.error(err);
        setDevices([]);
      });
  }, [location.pathname, navigate, searchParams]);

  useEffect(() => {
    refreshAccounts();
  }, [user.id, showAccount]);

  useEffect(() => {
    void refreshDevices();
  }, [user.id, refreshDevices]);

  useEffect(() => {
    const onDevicesChanged = () => {
      void refreshDevices();
    };
    window.addEventListener(DEVICES_CHANGED_EVENT, onDevicesChanged);
    return () => {
      window.removeEventListener(DEVICES_CHANGED_EVENT, onDevicesChanged);
    };
  }, [refreshDevices]);

  useEffect(() => {
    const onOpenAdd = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: DeviceType }>).detail;
      setAddDeviceDefaultType(detail?.type ?? routeType ?? "bioreactor");
      setShowAccount(false);
      setShowNotifications(false);
      setShowAppSettings(false);
      setShareDevice(null);
      setContextMenu(null);
      setShowAddDevice(true);
    };
    window.addEventListener(OPEN_ADD_DEVICE_EVENT, onOpenAdd);
    return () => {
      window.removeEventListener(OPEN_ADD_DEVICE_EVENT, onOpenAdd);
    };
  }, [routeType]);

  useEffect(() => {
    const unsubscribe = subscribeMyDevices(user.id, () => {
      void refreshDevices();
    });
    return unsubscribe;
  }, [user.id, refreshDevices]);

  useEffect(() => {
    let cancelled = false;
    const pullUnread = () => {
      listMyNotifications(40)
        .then((list) => {
          if (!cancelled) setUnread(unreadCount(list));
        })
        .catch(() => {
          /* optional until SQL applied */
        });
    };
    pullUnread();
    const unsubscribe = subscribeMyNotifications(user.id, pullUnread);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user.id]);

  useEffect(() => {
    setShareDevice(null);
    setShowAccount(false);
    setConfirmDeleteAccount(false);
    setShowAddDevice(false);
    setShowNotifications(false);
    setShowAppSettings(false);
    setContextMenu(null);
    setSettingsDevice(null);
    setSettingsAnchor(null);
  }, [location.pathname, location.search]);

  const closeOverlays = () => {
    setShowAccount(false);
    setConfirmDeleteAccount(false);
    setShareDevice(null);
    setShowAddDevice(false);
    setShowNotifications(false);
    setShowAppSettings(false);
    setContextMenu(null);
  };

  useEffect(() => {
    if (!confirmDeleteAccount) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setConfirmDeleteAccount(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDeleteAccount, busy]);

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
    setSettingsAnchor(null);
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
    setSettingsAnchor(null);
    setContextMenu({ device, x: event.clientX, y: event.clientY });
  };

  const onDeleteDevice = async (device: AccessibleDevice) => {
    const ok = window.confirm(
      t("nav.deleteConfirm", { name: device.name })
    );
    if (!ok) return;
    try {
      await deleteMyDevice(device.id);
      setSettingsDevice(null);
      setSettingsAnchor(null);
      await refreshDevices();
      if (preferredDeviceId === device.id || activeDevice?.id === device.id) {
        navigate("/bioreactor", { replace: true });
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("nav.couldNotDelete"));
    }
  };

  const onLeaveDevice = async (device: AccessibleDevice) => {
    const ok = window.confirm(t("nav.leaveConfirm", { name: device.name }));
    if (!ok) return;
    try {
      await leaveDevice(device.id);
      setSettingsDevice(null);
      await refreshDevices();
      if (preferredDeviceId === device.id) {
        navigate("/bioreactor", { replace: true });
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("nav.couldNotLeave"));
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
      setError(message || t("nav.couldNotSwitch"));
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
      setError(err instanceof Error ? err.message : t("nav.couldNotLogOut"));
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
      setConfirmDeleteAccount(false);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("nav.couldNotLogOut"));
    } finally {
      setBusy(false);
    }
  };

  const onRequestDeleteAccount = () => {
    setError(null);
    setShowAccount(false);
    setConfirmDeleteAccount(true);
  };

  const onConfirmDeleteAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteCurrentAccount();
      setConfirmDeleteAccount(false);
      refreshAccounts();
      if (!listStoredAccounts().some(isAccountSignedIn)) {
        navigate("/", { replace: true });
      } else {
        navigate("/bioreactor", { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("nav.couldNotDeleteAccount")
      );
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
            <span className="topbar__brand-text">{t("common.brand")}</span>
            <span className="topbar__sr-only">{statusTitle}</span>
          </Link>

          <div className="topbar__add" ref={addRef}>
            <button
              type="button"
              className={`topbar__round-btn topbar__add-btn ${
                showAddDevice ? "is-active" : ""
              }`}
              aria-label={t("nav.addDevice")}
              aria-expanded={showAddDevice}
              title={t("nav.addDevice")}
              onClick={() => {
                setShowAccount(false);
                setShareDevice(null);
                setSettingsDevice(null);
                setShowAppSettings(false);
                setShowNotifications(false);
                setAddDeviceDefaultType(routeType ?? "bioreactor");
                setShowAddDevice((open) => !open);
              }}
            >
              <AddOutline
                color="var(--bv-accent-hover)"
                height="18px"
                width="18px"
                title=""
              />
            </button>
            <AddDevicePanel
              open={showAddDevice}
              defaultType={addDeviceDefaultType}
              onClose={() => setShowAddDevice(false)}
              onCreated={onDeviceCreated}
            />
          </div>

          <div className="topbar__devices" ref={devicesRef} role="toolbar" aria-label={t("nav.devices")}>
            {devices.map((device) => {
              const active = activeDevice?.id === device.id;
              return (
                <button
                  key={device.id}
                  type="button"
                  data-device-id={device.id}
                  className={`topbar__device-chip ${active ? "is-active" : ""} ${
                    device.isOwner ? "" : "is-shared"
                  }`}
                  title={device.name}
                  aria-label={device.name}
                  aria-pressed={active}
                  onClick={() => onSelectDevice(device)}
                  onContextMenu={(event) => onDeviceContextMenu(event, device)}
                >
                  <span className="topbar__device-chip-label">{device.name}</span>
                  {!device.isOwner && (
                    <span
                      className="topbar__device-owner"
                      title={
                        device.ownerDisplayName
                          ? t("nav.sharedBy", { name: device.ownerDisplayName })
                          : t("nav.sharedDevice")
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
            <SharePanel
              user={user}
              open={Boolean(shareDevice)}
              initialDeviceId={shareDevice?.id ?? null}
              onClose={() => setShareDevice(null)}
              onDevicesChanged={refreshDevices}
            />
          </div>
        </div>

        {contextMenu && (
          <DeviceContextMenu
            device={contextMenu.device}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onSettings={(device) => {
              setShareDevice(null);
              setShowNotifications(false);
              setShowAccount(false);
              setShowAddDevice(false);
              setShowAppSettings(false);
              const btn = devicesRef.current?.querySelector(
                `[data-device-id="${device.id}"]`
              );
              const rect = btn?.getBoundingClientRect();
              setSettingsAnchor(
                rect
                  ? { x: rect.left, y: rect.bottom }
                  : { x: contextMenu.x, y: contextMenu.y }
              );
              setSettingsDevice(device);
            }}
            onShare={(device) => {
              setSettingsDevice(null);
              setSettingsAnchor(null);
              setShowAppSettings(false);
              setShareDevice(device);
            }}
            onDelete={(device) => {
              void onDeleteDevice(device);
            }}
            onLeave={(device) => {
              void onLeaveDevice(device);
            }}
          />
        )}

        <div className="topbar__right">
          <div className="topbar__settings-wrap">
            <button
              type="button"
              className={`topbar__icon-btn ${showAppSettings ? "is-active" : ""}`}
              aria-label={t("nav.settings")}
              aria-expanded={showAppSettings}
              title={t("nav.settings")}
              onClick={() => {
                setShowAccount(false);
                setShowAddDevice(false);
                setShowNotifications(false);
                setShareDevice(null);
                setSettingsDevice(null);
                setSettingsAnchor(null);
                setShowAppSettings((open) => !open);
              }}
            >
              <SettingsOutline
                color="var(--bv-text)"
                title={t("nav.settings")}
                height="20px"
                width="20px"
              />
            </button>
            <AppSettingsPanel
              open={showAppSettings}
              onClose={() => setShowAppSettings(false)}
            />
          </div>

          <DeviceSettingsPanel
            device={settingsDevice}
            open={Boolean(settingsDevice)}
            anchor={settingsAnchor}
            onClose={() => {
              setSettingsDevice(null);
              setSettingsAnchor(null);
            }}
            onRenamed={() => {
              void refreshDevices();
            }}
            onRequestDelete={(device) => {
              void onDeleteDevice(device);
            }}
          />

          <div className="topbar__notif-wrap">
            <button
              type="button"
              className={`topbar__icon-btn ${showNotifications ? "is-active" : ""}`}
              aria-label={
                unread > 0
                  ? t("nav.notificationsUnread", { count: unread })
                  : t("nav.notifications")
              }
              aria-expanded={showNotifications}
              onClick={() => {
                setShowAccount(false);
                setShowAddDevice(false);
                setShareDevice(null);
                setSettingsDevice(null);
                setShowAppSettings(false);
                setShowNotifications((open) => !open);
              }}
            >
              <NotificationsOutline
                color="var(--bv-text)"
                title={t("nav.notifications")}
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
              aria-label={t("nav.accountMenu")}
              onClick={() => {
                setShareDevice(null);
                setSettingsDevice(null);
                setShowAppSettings(false);
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
                    onClick={() => void onLogout()}
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
                  onClick={onAddAccount}
                >
                  {t("nav.addAccount")}
                </button>
                <button
                  type="button"
                  className="topbar__menu-logout"
                  disabled={busy}
                  onClick={() => void onLogoutAll()}
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
            )}
          </div>
        </div>
      </div>

      {confirmDeleteAccount && (
        <div className="topbar__confirm" role="presentation">
          <div
            className="topbar__confirm-backdrop"
            aria-hidden="true"
            onClick={() => {
              if (!busy) setConfirmDeleteAccount(false);
            }}
          />
          <div
            className="topbar__confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <p className="topbar__confirm-eyebrow">{t("nav.deleteAccount")}</p>
            <h2 id="delete-account-title" className="topbar__confirm-title">
              {t("nav.deleteAccountConfirmTitle")}
            </h2>
            <p className="topbar__confirm-body">
              {t("nav.deleteAccountConfirmBody")}
            </p>
            {error ? <p className="topbar__menu-error">{error}</p> : null}
            <div className="topbar__confirm-actions">
              <button
                type="button"
                className="topbar__menu-danger topbar__confirm-btn"
                disabled={busy}
                onClick={() => void onConfirmDeleteAccount()}
              >
                {busy ? t("nav.deletingAccount") : t("nav.deleteAccountConfirm")}
              </button>
              <button
                type="button"
                className="topbar__menu-secondary topbar__confirm-btn"
                disabled={busy}
                onClick={() => setConfirmDeleteAccount(false)}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;

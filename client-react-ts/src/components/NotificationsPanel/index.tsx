import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  acceptDeviceInvite,
  declineDeviceInvite,
  listMyNotifications,
  markNotificationRead,
  unreadCount,
  type AppNotification,
} from "../../lib/notifications";
import { openSharedDeviceUrl } from "../../lib/sharing";
import "./NotificationsPanel.css";

type NotificationsPanelProps = {
  open: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
  onDevicesChanged?: () => void | Promise<void>;
};

function timeAgo(
  iso: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("notifications.justNow");
  if (mins < 60) return t("notifications.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("notifications.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("notifications.daysAgo", { count: days });
}

function NotificationsPanel({
  open,
  onClose,
  onUnreadChange,
  onDevicesChanged,
}: NotificationsPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listMyNotifications();
      setItems(list);
      onUnreadChange?.(unreadCount(list));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.failedLoad"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        event.target instanceof Node &&
        !panelRef.current.contains(event.target)
      ) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  const onAccept = async (notification: AppNotification) => {
    const inviteId = notification.data.invite_id;
    if (!inviteId || busyId) return;
    setBusyId(notification.id);
    setError(null);
    try {
      const result = await acceptDeviceInvite(inviteId);
      await refresh();
      await onDevicesChanged?.();
      onClose();
      navigate(
        openSharedDeviceUrl({
          id: result.device_id,
          type: result.type,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.couldNotAccept"));
    } finally {
      setBusyId(null);
    }
  };

  const onDecline = async (notification: AppNotification) => {
    const inviteId = notification.data.invite_id;
    if (!inviteId || busyId) return;
    setBusyId(notification.id);
    setError(null);
    try {
      await declineDeviceInvite(inviteId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.couldNotDecline"));
    } finally {
      setBusyId(null);
    }
  };

  const onMarkRead = async (notification: AppNotification) => {
    if (notification.read_at) return;
    try {
      await markNotificationRead(notification.id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )
      );
      onUnreadChange?.(
        unreadCount(
          items.map((item) =>
            item.id === notification.id
              ? { ...item, read_at: new Date().toISOString() }
              : item
          )
        )
      );
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;

  return (
    <div
      className="notif-panel"
      ref={panelRef}
      role="dialog"
      aria-label={t("notifications.title")}
    >
      <div className="notif-panel__head">
        <div>
          <p className="notif-panel__eyebrow">{t("notifications.inbox")}</p>
          <h2 className="notif-panel__title">{t("notifications.title")}</h2>
        </div>
        <button
          type="button"
          className="notif-panel__close"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ×
        </button>
      </div>

      {loading && items.length === 0 ? (
        <p className="notif-panel__muted">{t("notifications.loading")}</p>
      ) : items.length === 0 ? (
        <p className="notif-panel__muted">{t("notifications.empty")}</p>
      ) : (
        <ul className="notif-panel__list">
          {items.map((notification) => {
            const pendingInvite =
              notification.kind === "device_invite" &&
              notification.invite_status === "pending";
            const resolved = notification.data.resolved;
            return (
              <li
                key={notification.id}
                className={`notif-panel__item ${
                  !notification.read_at && pendingInvite
                    ? "notif-panel__item--unread"
                    : ""
                }`}
              >
                <div className="notif-panel__item-top">
                  <p className="notif-panel__item-title">{notification.title}</p>
                  <span className="notif-panel__time">
                    {timeAgo(notification.created_at, t)}
                  </span>
                </div>
                {notification.body && (
                  <p className="notif-panel__item-body">{notification.body}</p>
                )}

                {pendingInvite ? (
                  <div className="notif-panel__actions">
                    <button
                      type="button"
                      className="notif-panel__accept"
                      disabled={busyId === notification.id}
                      onClick={() => onAccept(notification)}
                    >
                      {t("notifications.accept")}
                    </button>
                    <button
                      type="button"
                      className="notif-panel__decline"
                      disabled={busyId === notification.id}
                      onClick={() => onDecline(notification)}
                    >
                      {t("notifications.decline")}
                    </button>
                  </div>
                ) : (
                  <div className="notif-panel__footer">
                    {resolved && (
                      <span className="notif-panel__resolved">
                        {resolved === "accepted"
                          ? t("notifications.accepted")
                          : t("notifications.declined")}
                      </span>
                    )}
                    {!notification.read_at && !pendingInvite && (
                      <button
                        type="button"
                        className="notif-panel__text-btn"
                        onClick={() => onMarkRead(notification)}
                      >
                        {t("notifications.markRead")}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="notif-panel__error">{error}</p>}
    </div>
  );
}

export default NotificationsPanel;

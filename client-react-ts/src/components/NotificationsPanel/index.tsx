import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  acceptDeviceInvite,
  declineDeviceInvite,
  deleteNotification,
  listMyNotifications,
  markNotificationRead,
  unreadCount,
  type AppNotification,
} from "../../lib/notifications";
import {
  emitNotificationsChanged,
  NOTIFICATIONS_CHANGED_EVENT,
} from "../../lib/notificationsSync";
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

  const refresh = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const list = await listMyNotifications();
      setItems(list);
      onUnreadChange?.(unreadCount(list));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.failedLoad"));
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onChanged = () => {
      void refresh({ silent: true });
    };
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
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
      emitNotificationsChanged();
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
      emitNotificationsChanged();
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
      const next = items.map((item) =>
        item.id === notification.id
          ? { ...item, read_at: new Date().toISOString() }
          : item
      );
      setItems(next);
      onUnreadChange?.(unreadCount(next));
    } catch {
      /* ignore */
    }
  };

  const onDelete = async (notification: AppNotification) => {
    if (busyId) return;
    if (
      notification.kind === "device_invite" &&
      notification.invite_status === "pending"
    ) {
      return;
    }
    setBusyId(notification.id);
    setError(null);
    const previous = items;
    const next = items.filter((item) => item.id !== notification.id);
    setItems(next);
    onUnreadChange?.(unreadCount(next));
    try {
      await deleteNotification(notification.id);
      emitNotificationsChanged();
    } catch (err) {
      setItems(previous);
      onUnreadChange?.(unreadCount(previous));
      setError(
        err instanceof Error ? err.message : t("notifications.couldNotDelete")
      );
    } finally {
      setBusyId(null);
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
                  <div className="notif-panel__item-meta">
                    <span className="notif-panel__time">
                      {timeAgo(notification.created_at, t)}
                    </span>
                    {!pendingInvite && (
                      <button
                        type="button"
                        className="notif-panel__delete"
                        disabled={busyId === notification.id}
                        onClick={() => onDelete(notification)}
                        aria-label={t("notifications.delete")}
                        title={t("notifications.delete")}
                      >
                        ×
                      </button>
                    )}
                  </div>
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
                    <div className="notif-panel__footer-actions">
                      {!notification.read_at && (
                        <button
                          type="button"
                          className="notif-panel__text-btn"
                          onClick={() => onMarkRead(notification)}
                        >
                          {t("notifications.markRead")}
                        </button>
                      )}
                    </div>
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

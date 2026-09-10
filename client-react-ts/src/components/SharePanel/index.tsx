import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { Device } from "../../lib/devices";
import {
  SHARE_ROLE_OPTIONS,
  createShareLink,
  deviceTypeFromPath,
  inviteByEmail,
  inviteUrlForToken,
  listActiveShareLinks,
  listDeviceRoster,
  listShareableDevices,
  removeMember,
  revokeShareLink,
  updateMemberRole,
  type DeviceRosterMember,
  type ShareLinkRow,
  type ShareRole,
} from "../../lib/sharing";
import type { AppUser } from "../../lib/user";
import SegmentedControl from "../SegmentedControl";
import "./SharePanel.css";

type SharePanelProps = {
  user: AppUser;
  open: boolean;
  onClose: () => void;
};

function shortToken(token: string) {
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

function SharePanel({ user, open, onClose }: SharePanelProps) {
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [role, setRole] = useState<ShareRole>("viewer");
  const [email, setEmail] = useState("");
  const [roster, setRoster] = useState<DeviceRosterMember[]>([]);
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selected = devices.find((d) => d.id === deviceId) ?? null;
  const canAdmin = Boolean(selected);
  const roleHint =
    SHARE_ROLE_OPTIONS.find((option) => option.value === role)?.hint ?? "";

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

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessage(null);

    listShareableDevices()
      .then((list) => {
        if (cancelled) return;
        setDevices(list);
        const preferredType = deviceTypeFromPath(location.pathname);
        const preferred =
          (preferredType && list.find((d) => d.type === preferredType)) ||
          list[0];
        setDeviceId(preferred?.id ?? "");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load devices");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, location.pathname, user.id]);

  useEffect(() => {
    if (!open || !deviceId) {
      setRoster([]);
      setLinks([]);
      return;
    }

    let cancelled = false;
    Promise.all([listDeviceRoster(deviceId), listActiveShareLinks(deviceId)])
      .then(([members, activeLinks]) => {
        if (cancelled) return;
        setRoster(members);
        setLinks(activeLinks);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load roster");
      });

    return () => {
      cancelled = true;
    };
  }, [open, deviceId]);

  const refreshAccess = async () => {
    if (!deviceId) return;
    const [members, activeLinks] = await Promise.all([
      listDeviceRoster(deviceId),
      listActiveShareLinks(deviceId),
    ]);
    setRoster(members);
    setLinks(activeLinks);
  };

  const onCopyLink = async () => {
    if (!deviceId || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setCopied(false);
    try {
      const token = await createShareLink(deviceId, role);
      const url = inviteUrlForToken(token);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setMessage(
        "Invite link copied. Recipients must accept from their notifications bell."
      );
      await refreshAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create link");
    } finally {
      setBusy(false);
    }
  };

  const onInviteEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (!deviceId || !email.trim() || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await inviteByEmail(deviceId, email.trim(), role);
      setEmail("");
      setMessage(
        `Invite sent to ${email.trim()}. They must accept it from Notifications.`
      );
      await refreshAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  };

  const onChangeRole = async (member: DeviceRosterMember, next: ShareRole) => {
    if (member.role === "owner" || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateMemberRole(member.member_id, next);
      await refreshAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update role");
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (member: DeviceRosterMember) => {
    if (member.role === "owner" || busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeMember(member.member_id);
      await refreshAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove member");
    } finally {
      setBusy(false);
    }
  };

  const onRevokeLink = async (link: ShareLinkRow) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await revokeShareLink(link.id);
      await refreshAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke link");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="share-panel" ref={panelRef} role="dialog" aria-label="Share device">
      <div className="share-panel__head">
        <div>
          <p className="share-panel__eyebrow">Share</p>
          <h2 className="share-panel__title">Invite people</h2>
        </div>
        <button type="button" className="share-panel__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {loading ? (
        <p className="share-panel__muted">Loading your devices…</p>
      ) : devices.length === 0 ? (
        <p className="share-panel__muted">
          No devices you can share yet. Create one with + in the header first.
        </p>
      ) : (
        <>
          <label className="share-panel__label" htmlFor="share-device">
            Device
          </label>
          <select
            id="share-device"
            className="share-panel__select"
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
          >
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>

          <p className="share-panel__label">Access level</p>
          <SegmentedControl
            aria-label="Share role"
            shape="rounded"
            accent
            value={role}
            onChange={(value) => setRole(value as ShareRole)}
            options={SHARE_ROLE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <p className="share-panel__hint">{roleHint}</p>

          <button
            type="button"
            className="share-panel__primary"
            onClick={onCopyLink}
            disabled={!canAdmin || busy}
          >
            {copied ? "Link copied" : "Copy invite link"}
          </button>

          <form className="share-panel__email" onSubmit={onInviteEmail}>
            <label className="share-panel__label" htmlFor="share-email">
              Invite by email
            </label>
            <div className="share-panel__email-row">
              <input
                id="share-email"
                type="email"
                className="share-panel__input"
                placeholder="colleague@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
                required
              />
              <button
                type="submit"
                className="share-panel__secondary"
                disabled={!canAdmin || busy || !email.trim()}
              >
                Invite
              </button>
            </div>
            <p className="share-panel__hint">
              They need a Bioversee account and must accept from the bell icon
              before the device appears for them.
            </p>
          </form>

          <div className="share-panel__section">
            <p className="share-panel__label">People with access</p>
            {roster.length === 0 ? (
              <p className="share-panel__muted">Only you so far.</p>
            ) : (
              <ul className="share-panel__list">
                {roster.map((member) => {
                  const isSelf = member.user_id === user.id;
                  const isOwner = member.role === "owner";
                  return (
                    <li key={member.member_id} className="share-panel__row">
                      <div className="share-panel__person">
                        <img
                          className="share-panel__avatar"
                          src={
                            member.avatar_url ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                              member.display_name
                            )}`
                          }
                          alt=""
                        />
                        <div>
                          <p className="share-panel__name">
                            {member.display_name}
                            {isSelf ? " (you)" : ""}
                          </p>
                          <p className="share-panel__meta">
                            {member.email ?? "No email"}
                          </p>
                        </div>
                      </div>
                      {isOwner ? (
                        <span className="share-panel__pill">Owner</span>
                      ) : (
                        <div className="share-panel__actions">
                          <select
                            className="share-panel__role"
                            value={member.role}
                            disabled={busy}
                            onChange={(event) =>
                              onChangeRole(
                                member,
                                event.target.value as ShareRole
                              )
                            }
                            aria-label={`Role for ${member.display_name}`}
                          >
                            {SHARE_ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="share-panel__text-btn"
                            disabled={busy}
                            onClick={() => onRemove(member)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {links.length > 0 && (
            <div className="share-panel__section">
              <p className="share-panel__label">Active invite links</p>
              <ul className="share-panel__list">
                {links.map((link) => (
                  <li key={link.id} className="share-panel__row">
                    <div>
                      <p className="share-panel__name">
                        {link.role} · {shortToken(link.token)}
                      </p>
                      <p className="share-panel__meta">
                        Used {link.use_count}
                        {link.expires_at
                          ? ` · expires ${new Date(link.expires_at).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="share-panel__text-btn"
                      disabled={busy}
                      onClick={() => onRevokeLink(link)}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {message && <p className="share-panel__success">{message}</p>}
      {error && <p className="share-panel__error">{error}</p>}
    </div>
  );
}

export default SharePanel;

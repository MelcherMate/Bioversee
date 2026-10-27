import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { notifyDevicesChanged } from "../../lib/onboarding";
import { canAdminPlant, type Plant } from "../../lib/plants";
import {
  SHARE_ROLE_OPTIONS,
  createShareLink,
  inviteByEmail,
  inviteUrlForToken,
  leavePlant,
  listActiveShareLinks,
  listPlantRoster,
  removeMember,
  revokeShareLink,
  roleLabel,
  updateMemberRole,
  type PlantRosterMember,
  type ShareLinkRow,
  type ShareRole,
} from "../../lib/sharing";
import type { AppUser } from "../../lib/user";
import SegmentedControl from "../SegmentedControl";

type PlantShareFormProps = {
  user: AppUser;
  plant: Plant;
  onChanged?: () => void | Promise<void>;
  onLeft?: () => void;
  className?: string;
};

function shortToken(token: string) {
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export default function PlantShareForm({
  user,
  plant,
  onChanged,
  onLeft,
  className,
}: PlantShareFormProps) {
  const { t } = useTranslation();
  const canAdmin = canAdminPlant(plant.role);
  const [role, setRole] = useState<ShareRole>("viewer");
  const [email, setEmail] = useState("");
  const [roster, setRoster] = useState<PlantRosterMember[]>([]);
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const roleHintKey =
    SHARE_ROLE_OPTIONS.find((option) => option.value === role)?.hintKey;
  const roleHint = roleHintKey ? t(roleHintKey) : "";

  const refreshAccess = async () => {
    const members = await listPlantRoster(plant.id);
    setRoster(members);
    if (canAdmin) {
      setLinks(await listActiveShareLinks(plant.id));
    } else {
      setLinks([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setMessage(null);
    setCopied(false);
    setEmail("");
    setRole("viewer");

    void (async () => {
      try {
        const members = await listPlantRoster(plant.id);
        if (cancelled) return;
        setRoster(members);
        if (canAdminPlant(plant.role)) {
          const activeLinks = await listActiveShareLinks(plant.id);
          if (cancelled) return;
          setLinks(activeLinks);
        } else {
          setLinks([]);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : t("share.failedLoadRoster")
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plant.id, plant.role, t]);

  const onCopyLink = async () => {
    if (!canAdmin || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setCopied(false);
    try {
      const token = await createShareLink(plant.id, role);
      await navigator.clipboard.writeText(inviteUrlForToken(token));
      setCopied(true);
      setMessage(t("share.linkCopiedMsg"));
      await refreshAccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("share.couldNotCreateLink")
      );
    } finally {
      setBusy(false);
    }
  };

  const onInviteEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (!canAdmin || !email.trim() || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const trimmed = email.trim();
      await inviteByEmail(plant.id, trimmed, role);
      setEmail("");
      setMessage(t("share.inviteSent", { email: trimmed }));
      await refreshAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("share.inviteFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onChangeRole = async (member: PlantRosterMember, next: ShareRole) => {
    if (!canAdmin || member.role === "owner" || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateMemberRole(member.member_id, next);
      await refreshAccess();
      notifyDevicesChanged();
      await onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("share.couldNotUpdateRole")
      );
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (member: PlantRosterMember) => {
    if (!canAdmin || member.role === "owner" || busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeMember(member.member_id);
      await refreshAccess();
      notifyDevicesChanged();
      await onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("share.couldNotRemove"));
    } finally {
      setBusy(false);
    }
  };

  const onLeave = async () => {
    if (plant.role === "owner" || busy) return;
    setBusy(true);
    setError(null);
    try {
      await leavePlant(plant.id);
      notifyDevicesChanged();
      await onChanged?.();
      onLeft?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("share.couldNotLeave"));
    } finally {
      setBusy(false);
    }
  };

  const onRevokeLink = async (link: ShareLinkRow) => {
    if (!canAdmin || busy) return;
    setBusy(true);
    setError(null);
    try {
      await revokeShareLink(link.id);
      await refreshAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("share.couldNotRevoke"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className ?? undefined}>
      {canAdmin ? (
        <>
          <p className="share-panel__label">{t("share.accessLevel")}</p>
          <SegmentedControl
            aria-label={t("share.accessLevel")}
            shape="rounded"
            accent
            value={role}
            onChange={(value) => setRole(value as ShareRole)}
            options={SHARE_ROLE_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
          />
          <p className="share-panel__hint">{roleHint}</p>

          <button
            type="button"
            className="share-panel__primary"
            onClick={() => void onCopyLink()}
            disabled={busy}
          >
            {copied ? t("share.linkCopied") : t("share.copyLink")}
          </button>

          <form className="share-panel__email" onSubmit={onInviteEmail}>
            <label className="share-panel__label" htmlFor={`share-email-${plant.id}`}>
              {t("share.inviteByEmail")}
            </label>
            <div className="share-panel__email-row">
              <input
                id={`share-email-${plant.id}`}
                type="email"
                className="share-panel__input"
                placeholder={t("share.emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
                required
              />
              <button
                type="submit"
                className="share-panel__secondary"
                disabled={busy || !email.trim()}
              >
                {t("share.invite")}
              </button>
            </div>
            <p className="share-panel__hint">{t("share.inviteHint")}</p>
          </form>
        </>
      ) : (
        <p className="share-panel__hint">{t("share.viewOnlyHint")}</p>
      )}

      <div className="share-panel__section">
        <p className="share-panel__label">{t("share.peopleWithAccess")}</p>
        {roster.length === 0 ? (
          <p className="share-panel__muted">{t("share.onlyYou")}</p>
        ) : (
          <ul className="share-panel__list">
            {roster.map((member) => {
              const isSelf = member.user_id === user.id;
              const isOwnerRole = member.role === "owner";
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
                        {isSelf ? ` ${t("common.you")}` : ""}
                      </p>
                      <p className="share-panel__meta">
                        {member.email ?? t("common.noEmail")}
                      </p>
                    </div>
                  </div>
                  {isOwnerRole ? (
                    <span className="share-panel__pill">{t("common.owner")}</span>
                  ) : canAdmin ? (
                    <div className="share-panel__actions">
                      <select
                        className="share-panel__role"
                        value={member.role}
                        disabled={busy}
                        onChange={(event) =>
                          void onChangeRole(
                            member,
                            event.target.value as ShareRole
                          )
                        }
                        aria-label={t("addDevice.accessFor", {
                          name: member.display_name,
                        })}
                      >
                        {SHARE_ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="share-panel__text-btn"
                        disabled={busy}
                        onClick={() => void onRemove(member)}
                      >
                        {t("common.remove")}
                      </button>
                    </div>
                  ) : isSelf ? (
                    <div className="share-panel__actions">
                      <span className="share-panel__pill">
                        {roleLabel(member.role)}
                      </span>
                      <button
                        type="button"
                        className="share-panel__text-btn"
                        disabled={busy}
                        onClick={() => void onLeave()}
                      >
                        {t("common.leave")}
                      </button>
                    </div>
                  ) : (
                    <span className="share-panel__pill">
                      {roleLabel(member.role)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canAdmin && links.length > 0 ? (
        <div className="share-panel__section">
          <p className="share-panel__label">{t("share.activeLinks")}</p>
          <ul className="share-panel__list">
            {links.map((link) => (
              <li key={link.id} className="share-panel__row">
                <div>
                  <p className="share-panel__name">
                    {roleLabel(link.role)} · {shortToken(link.token)}
                  </p>
                  <p className="share-panel__meta">
                    {t("share.used", { count: link.use_count })}
                    {link.expires_at
                      ? ` · ${t("share.expires", {
                          date: new Date(link.expires_at).toLocaleDateString(),
                        })}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="share-panel__text-btn"
                  disabled={busy}
                  onClick={() => void onRevokeLink(link)}
                >
                  {t("share.revoke")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? <p className="share-panel__success">{message}</p> : null}
      {error ? <p className="share-panel__error">{error}</p> : null}
    </div>
  );
}

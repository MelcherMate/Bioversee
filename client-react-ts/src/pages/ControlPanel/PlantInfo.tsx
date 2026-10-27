import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AddOutline, PaperPlaneOutline, TrashOutline } from "react-ionicons";
import SegmentedControl from "../../components/SegmentedControl";
import type { AccessibleDevice, DeviceCardSnapshot } from "../../lib/devices";
import { notifyDevicesChanged } from "../../lib/onboarding";
import { canAdminPlant, type Plant } from "../../lib/plants";
import {
  SHARE_ROLE_OPTIONS,
  inviteByEmail,
  removeMember,
  type ShareRole,
} from "../../lib/sharing";

const ONLINE_MS = 2 * 60 * 1000;

export type PlantPeople = {
  memberId: string | null;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
  isManager: boolean;
};

type PlantInfoProps = {
  plant: Plant;
  devices: AccessibleDevice[];
  snapshots: DeviceCardSnapshot[];
  people: PlantPeople[];
  editing: boolean;
  /** Bumped to focus the title field (rename from the plant menu, new plant). */
  titleFocusKey: number;
  onRename: (name: string) => Promise<void>;
  onPeopleChanged?: () => void | Promise<void>;
};

function PlantTitle({
  plant,
  editing,
  focusKey,
  onRename,
}: {
  plant: Plant;
  editing: boolean;
  focusKey: number;
  onRename: (name: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState(plant.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(plant.name);
    setError(null);
  }, [plant.id, plant.name]);

  useEffect(() => {
    if (!editing || focusKey === 0) return;
    const input = inputRef.current;
    input?.focus();
    input?.select();
  }, [editing, focusKey]);

  const commit = async () => {
    const name = draft.trim();
    if (!name) {
      setDraft(plant.name);
      return;
    }
    if (name === plant.name || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onRename(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDraft(plant.name);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) return <h2 className="cp-info__name">{plant.name}</h2>;

  return (
    <>
      <input
        ref={inputRef}
        className="cp-info__name cp-info__name-input"
        value={draft}
        maxLength={80}
        disabled={saving}
        aria-label={t("controlPanel.renamePlant")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(plant.name);
            requestAnimationFrame(() => inputRef.current?.blur());
          }
        }}
      />
      {error && <p className="cp-info__error">{error}</p>}
    </>
  );
}

function AddUserRow({
  plantId,
  onInvited,
}: {
  plantId: string;
  onInvited?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const emailRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    emailRef.current?.focus();
  }, [open]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await inviteByEmail(plantId, trimmed, role);
      setEmail("");
      setRole("viewer");
      setOpen(false);
      setMessage(t("share.inviteSent", { email: trimmed }));
      notifyDevicesChanged();
      await onInvited?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("share.inviteFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="cp-info__add-wrap">
        <button
          type="button"
          className="cp-info__add-user"
          onClick={() => {
            setError(null);
            setMessage(null);
            setOpen(true);
          }}
        >
          <AddOutline color="currentColor" height="16px" width="16px" title="" />
          {t("controlPanel.addUser")}
        </button>
        {message ? <p className="cp-info__success">{message}</p> : null}
      </div>
    );
  }

  return (
    <form className="cp-info__invite" onSubmit={(e) => void onSubmit(e)}>
      <input
        ref={emailRef}
        type="email"
        className="cp-info__invite-email"
        placeholder={t("share.emailPlaceholder")}
        value={email}
        disabled={busy}
        autoComplete="email"
        required
        onChange={(event) => {
          setEmail(event.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setError(null);
          }
        }}
      />
      <div className="cp-info__invite-row">
        <SegmentedControl
          className="cp-info__invite-roles"
          aria-label={t("share.accessLevel")}
          shape="rounded"
          accent
          value={role}
          onChange={(value) => setRole(value as ShareRole)}
          disabled={busy}
          options={SHARE_ROLE_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />
        <div className="cp-info__invite-actions">
          <button
            type="button"
            className="cp-info__invite-cancel"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="cp-info__invite-send"
            disabled={busy || !email.trim()}
          >
            <PaperPlaneOutline
              color="currentColor"
              height="14px"
              width="14px"
              title=""
            />
            {busy ? t("common.sending") : t("controlPanel.sendInvite")}
          </button>
        </div>
      </div>
      {error ? <p className="cp-info__error">{error}</p> : null}
    </form>
  );
}

function isLive(snapshot: DeviceCardSnapshot | undefined): boolean {
  if (!snapshot) return false;
  const times = [
    snapshot.updated_at,
    ...snapshot.metrics.map((m) => m.created_at),
  ]
    .map((t) => Date.parse(t))
    .filter((n) => !Number.isNaN(n));
  if (times.length === 0) return false;
  return Date.now() - Math.max(...times) < ONLINE_MS;
}

export default function PlantInfo({
  plant,
  devices,
  snapshots,
  people,
  editing,
  titleFocusKey,
  onRename,
  onPeopleChanged,
}: PlantInfoProps) {
  const { t } = useTranslation();
  const snapById = new Map(snapshots.map((s) => [s.id, s]));
  const running = devices.filter((d) => isLive(snapById.get(d.id))).length;
  const sharedCount = people.filter((p) => !p.roles.includes("owner")).length;
  const managers = people.filter((p) => p.isManager);
  const collaborators = people.filter((p) => !p.isManager);
  const canManagePeople = editing && canAdminPlant(plant.role);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const onRemovePerson = async (person: PlantPeople) => {
    if (!person.memberId || person.roles.includes("owner") || removingId) {
      return;
    }
    const ok = window.confirm(
      t("controlPanel.removeUserConfirm", { name: person.displayName })
    );
    if (!ok) return;
    setRemovingId(person.memberId);
    setRemoveError(null);
    try {
      await removeMember(person.memberId);
      notifyDevicesChanged();
      await onPeopleChanged?.();
    } catch (err) {
      setRemoveError(
        err instanceof Error ? err.message : t("share.couldNotRemove")
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section
      className={`cp-info ${editing ? "is-editing" : ""}`}
      aria-label={t("controlPanel.plantInfo")}
    >
      <div className="cp-info__intro">
        <div className="cp-info__heading">
          <p className="cp-info__eyebrow">{t("controlPanel.productionLine")}</p>
          <PlantTitle
            plant={plant}
            editing={editing && plant.role === "owner"}
            focusKey={titleFocusKey}
            onRename={onRename}
          />
        </div>
        <div className="cp-info__stats">
          <div className="cp-info__stat">
            <span className="cp-info__stat-value">{devices.length}</span>
            <span className="cp-info__stat-label">
              {t("controlPanel.statDevices")}
            </span>
          </div>
          <div className="cp-info__stat">
            <span className="cp-info__stat-value">{running}</span>
            <span className="cp-info__stat-label">
              {t("controlPanel.statRunning")}
            </span>
          </div>
          <div className="cp-info__stat">
            <span className="cp-info__stat-value">{people.length}</span>
            <span className="cp-info__stat-label">
              {t("controlPanel.statPeople")}
            </span>
          </div>
        </div>
      </div>

      <div className="cp-info__columns">
        <div className="cp-info__block">
          <h3 className="cp-info__block-title">{t("controlPanel.people")}</h3>
          {people.length === 0 ? (
            <p className="cp-info__muted">{t("controlPanel.noPeople")}</p>
          ) : (
            <ul className="cp-info__people">
              {[...managers, ...collaborators].map((person) => {
                const isOwner = person.roles.includes("owner");
                const canDelete =
                  canManagePeople && !isOwner && Boolean(person.memberId);
                return (
                  <li key={person.userId} className="cp-info__person">
                    <span className="cp-info__avatar" aria-hidden>
                      {person.avatarUrl ? (
                        <img src={person.avatarUrl} alt="" />
                      ) : (
                        (person.displayName.slice(0, 1) || "?").toUpperCase()
                      )}
                    </span>
                    <span className="cp-info__person-text">
                      <span className="cp-info__person-name">
                        {person.displayName}
                        {person.isManager
                          ? ` · ${t("controlPanel.plantManager")}`
                          : ""}
                      </span>
                      <span className="cp-info__person-role">
                        {person.roles
                          .map((role) =>
                            role === "owner"
                              ? t("common.owner")
                              : t(`roles.${role}`, { defaultValue: role })
                          )
                          .join(", ")}
                      </span>
                    </span>
                    {canDelete ? (
                      <button
                        type="button"
                        className="cp-info__person-delete"
                        disabled={removingId === person.memberId}
                        onClick={() => void onRemovePerson(person)}
                      >
                        <TrashOutline
                          color="currentColor"
                          height="14px"
                          width="14px"
                          title=""
                        />
                        {t("common.delete")}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {removeError ? <p className="cp-info__error">{removeError}</p> : null}
          {sharedCount > 0 && (
            <p className="cp-info__note">
              {t("controlPanel.sharedInPlant", { count: sharedCount })}
            </p>
          )}
          {canManagePeople ? (
            <AddUserRow
              key={plant.id}
              plantId={plant.id}
              onInvited={onPeopleChanged}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

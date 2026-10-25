import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AccessibleDevice, DeviceCardSnapshot } from "../../lib/devices";
import { DEVICE_TYPE_META } from "../../lib/deviceIcons";
import { pathForDeviceType } from "../../lib/sharing";
import type { Plant } from "../../lib/plants";
import DeviceTypeGlyph from "./DeviceTypeGlyph";

const ONLINE_MS = 2 * 60 * 1000;

export type PlantPeople = {
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
}: PlantInfoProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const snapById = new Map(snapshots.map((s) => [s.id, s]));
  const running = devices.filter((d) => isLive(snapById.get(d.id))).length;
  const sharedCount = devices.filter((d) => !d.isOwner).length;
  const managers = people.filter((p) => p.isManager);
  const collaborators = people.filter((p) => !p.isManager);

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
            editing={editing}
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
          <h3 className="cp-info__block-title">{t("controlPanel.machines")}</h3>
          {devices.length === 0 ? (
            <p className="cp-info__muted">{t("controlPanel.noMachines")}</p>
          ) : (
            <ul className="cp-info__machines">
              {devices.map((device) => {
                const live = isLive(snapById.get(device.id));
                const meta = DEVICE_TYPE_META[device.type];
                return (
                  <li key={device.id}>
                    <button
                      type="button"
                      className="cp-info__machine"
                      onClick={() =>
                        navigate(
                          `${pathForDeviceType(device.type)}?device=${device.id}`
                        )
                      }
                    >
                      <span className="cp-info__machine-glyph">
                        <DeviceTypeGlyph type={device.type} size={18} />
                      </span>
                      <span className="cp-info__machine-text">
                        <span className="cp-info__machine-name">
                          {device.name}
                        </span>
                        <span className="cp-info__machine-type">
                          {meta ? t(meta.labelKey) : device.type}
                          {!device.isOwner
                            ? ` · ${t("controlPanel.sharedDevice")}`
                            : ""}
                        </span>
                      </span>
                      <span
                        className={`cp-info__dot ${live ? "is-live" : "is-idle"}`}
                        title={
                          live
                            ? t("controlPanel.live")
                            : t("controlPanel.idle")
                        }
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {sharedCount > 0 && (
            <p className="cp-info__note">
              {t("controlPanel.sharedInPlant", { count: sharedCount })}
            </p>
          )}
        </div>

        <div className="cp-info__block">
          <h3 className="cp-info__block-title">{t("controlPanel.people")}</h3>
          {people.length === 0 ? (
            <p className="cp-info__muted">{t("controlPanel.noPeople")}</p>
          ) : (
            <ul className="cp-info__people">
              {[...managers, ...collaborators].map((person) => (
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

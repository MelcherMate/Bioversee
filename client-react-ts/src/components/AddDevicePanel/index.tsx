import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  createMyDevice,
  updateMyDeviceConfig,
  type DeviceType,
} from "../../lib/devices";
import { DEVICE_TYPE_META } from "../../lib/deviceIcons";
import {
  defaultBioreactorConfig,
  parseVolumeInput,
  toBioreactorConfigPatch,
  type BioreactorConfig,
  type BioreactorEquipment,
  type VolumeUnit,
} from "../../lib/bioreactorGeometry";
import {
  inviteByEmail,
  SHARE_ROLE_OPTIONS,
  type ShareRole,
} from "../../lib/sharing";
import EquipmentChecklist from "../EquipmentChecklist";
import "./AddDevicePanel.css";

/** Creation is bioreactor-only for now. */
const CREATE_DEVICE_TYPE: DeviceType = "bioreactor";

type AddDevicePanelProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (deviceId: string, type: DeviceType) => void;
  defaultType?: DeviceType;
};

type MemberDraft = {
  email: string;
  role: ShareRole;
};

function emailInitials(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._\-+]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

function emailDisplayName(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._\-+]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function AddDevicePanel({
  open,
  onClose,
  onCreated,
}: AddDevicePanelProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [name, setName] = useState("");
  const [config, setConfig] = useState<BioreactorConfig>(() =>
    defaultBioreactorConfig(),
  );
  const [volumeText, setVolumeText] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(t(DEVICE_TYPE_META[CREATE_DEVICE_TYPE].labelKey));
    setConfig(defaultBioreactorConfig());
    setVolumeText("");
    setMemberEmail("");
    setMembers([]);
    setError(null);
  }, [open, t]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const setVolumeUnit = (unit: VolumeUnit) => {
    setVolumeText("");
    setConfig((prev) => ({ ...prev, volume_unit: unit, volume_m3: null }));
  };

  const onVolumeTextChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
    setVolumeText(raw);
    if (!cleaned.trim()) {
      setConfig((prev) => ({ ...prev, volume_m3: null }));
      return;
    }
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return;
    setConfig((prev) => ({
      ...prev,
      volume_m3: parseVolumeInput(n, prev.volume_unit),
    }));
  };

  const setEquipment = (equipment: BioreactorEquipment) => {
    setConfig((prev) => ({ ...prev, equipment }));
  };

  const addMember = () => {
    const email = memberEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("addDevice.invalidEmail"));
      return;
    }
    if (members.some((m) => m.email === email)) {
      setError(t("addDevice.emailAlreadyListed"));
      return;
    }
    setMembers((prev) => [...prev, { email, role: "viewer" }]);
    setMemberEmail("");
    setError(null);
  };

  const setMemberRole = (email: string, role: ShareRole) => {
    setMembers((prev) =>
      prev.map((member) =>
        member.email === email ? { ...member, role } : member,
      ),
    );
  };

  const removeMember = (email: string) => {
    setMembers((prev) => prev.filter((member) => member.email !== email));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const deviceId = await createMyDevice({
        type: CREATE_DEVICE_TYPE,
        name: name.trim(),
      });
      await updateMyDeviceConfig(deviceId, toBioreactorConfigPatch(config));
      for (const member of members) {
        await inviteByEmail(deviceId, member.email, member.role);
      }
      onCreated(deviceId, CREATE_DEVICE_TYPE);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("addDevice.couldNotCreate"));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const meta = DEVICE_TYPE_META[CREATE_DEVICE_TYPE];
  const volumePlaceholder =
    config.volume_unit === "L"
      ? t("deviceSettings.volumePlaceholderL")
      : t("deviceSettings.volumePlaceholderM3");

  return createPortal(
    <div className="add-device" role="presentation">
      <button
        type="button"
        className="add-device__backdrop"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        className="add-device__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.addDevice")}
      >
        <div className="add-device__head">
          <div>
            <p className="add-device__eyebrow">{t("addDevice.eyebrow")}</p>
            <h2 className="add-device__title">{t("addDevice.title")}</h2>
          </div>
          <button
            type="button"
            className="add-device__close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>

        <form className="add-device__form" onSubmit={onSubmit}>
          <p className="add-device__label">{t("addDevice.type")}</p>
          <div className="add-device__type-static">
            <span className="add-device__type-label">{t(meta.labelKey)}</span>
          </div>
          <p className="add-device__hint">{t(meta.descriptionKey)}</p>

          <label className="add-device__label" htmlFor="add-device-name">
            {t("addDevice.name")}
          </label>
          <input
            id="add-device-name"
            className="add-device__input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("addDevice.namePlaceholder")}
            maxLength={80}
            required
            autoFocus
          />

          <div className="add-device__geometry">
            <div className="add-device__volume-row">
              <label className="add-device__label" htmlFor="add-geo-volume">
                {t("deviceSettings.volume")}
              </label>
              <div className="add-device__unit-toggle" role="group">
                <button
                  type="button"
                  className={
                    config.volume_unit === "L" ? "is-active" : undefined
                  }
                  disabled={busy}
                  onClick={() => setVolumeUnit("L")}
                >
                  L
                </button>
                <button
                  type="button"
                  className={
                    config.volume_unit === "m3" ? "is-active" : undefined
                  }
                  disabled={busy}
                  onClick={() => setVolumeUnit("m3")}
                >
                  m³
                </button>
              </div>
            </div>
            <p className="add-device__hint">
              {t("deviceSettings.volumeHint")}
            </p>
            <input
              id="add-geo-volume"
              className="add-device__input"
              type="text"
              inputMode="decimal"
              value={volumeText}
              placeholder={volumePlaceholder}
              disabled={busy}
              onChange={(event) => onVolumeTextChange(event.target.value)}
            />
          </div>

          <section className="add-device__equipment">
            <p className="add-device__label">{t("equipment.title")}</p>
            <p className="add-device__hint">{t("equipment.hint")}</p>
            <EquipmentChecklist
              value={config.equipment}
              onChange={setEquipment}
              disabled={busy}
            />
          </section>

          <section
            className="add-device__invite"
            aria-labelledby="add-invite-heading"
          >
            <p className="add-device__label" id="add-invite-heading">
              {t("addDevice.invitePeople")}
            </p>
            <p className="add-device__hint">{t("addDevice.membersHint")}</p>

            <div className="add-device__member-row">
              <input
                id="add-device-email"
                type="email"
                className="add-device__input"
                placeholder={t("addDevice.emailPlaceholder")}
                value={memberEmail}
                disabled={busy}
                autoComplete="email"
                onChange={(event) => {
                  setMemberEmail(event.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addMember();
                  }
                }}
              />
              <button
                type="button"
                className="add-device__secondary"
                onClick={addMember}
                disabled={busy || !memberEmail.trim()}
              >
                {t("addDevice.invite")}
              </button>
            </div>

            {members.length > 0 ? (
              <ul className="add-device__members">
                {members.map((member) => {
                  const roleMeta = SHARE_ROLE_OPTIONS.find(
                    (option) => option.value === member.role,
                  );
                  return (
                    <li key={member.email} className="add-device__member">
                      <div className="add-device__member-identity">
                        <span
                          className="add-device__avatar"
                          aria-hidden="true"
                        >
                          {emailInitials(member.email)}
                        </span>
                        <div className="add-device__member-text">
                          <span className="add-device__member-name">
                            {emailDisplayName(member.email)}
                          </span>
                          <span className="add-device__member-email">
                            {member.email}
                          </span>
                        </div>
                      </div>

                      <div className="add-device__member-access">
                        <label
                          className="add-device__sr-only"
                          htmlFor={`role-${member.email}`}
                        >
                          {t("addDevice.accessFor", {
                            name: emailDisplayName(member.email),
                          })}
                        </label>
                        <select
                          id={`role-${member.email}`}
                          className="add-device__role-select"
                          value={member.role}
                          disabled={busy}
                          onChange={(event) =>
                            setMemberRole(
                              member.email,
                              event.target.value as ShareRole,
                            )
                          }
                        >
                          {SHARE_ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {t(option.labelKey)}
                            </option>
                          ))}
                        </select>
                        {roleMeta ? (
                          <p className="add-device__role-hint">
                            {t(roleMeta.hintKey)}
                          </p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        className="add-device__remove"
                        onClick={() => removeMember(member.email)}
                        disabled={busy}
                        aria-label={t("addDevice.removeInvite", {
                          email: member.email,
                        })}
                      >
                        {t("common.remove")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="add-device__empty">{t("addDevice.noInvitesYet")}</p>
            )}
          </section>

          <button
            type="submit"
            className="add-device__primary"
            disabled={busy || !name.trim()}
          >
            {busy ? t("addDevice.creating") : t("addDevice.create")}
          </button>
          {error && <p className="add-device__error">{error}</p>}
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default AddDevicePanel;

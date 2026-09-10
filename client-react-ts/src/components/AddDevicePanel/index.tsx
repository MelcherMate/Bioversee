import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createMyDevice,
  isLegacyDeviceType,
  type DeviceType,
} from "../../lib/devices";
import { DEVICE_TYPE_META, DEVICE_TYPE_ORDER } from "../../lib/deviceIcons";
import {
  inviteByEmail,
  SHARE_ROLE_OPTIONS,
  type ShareRole,
} from "../../lib/sharing";
import SegmentedControl from "../SegmentedControl";
import "./AddDevicePanel.css";

type AddDevicePanelProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (deviceId: string, type: DeviceType) => void;
};

type MemberDraft = {
  email: string;
  role: ShareRole;
};

function AddDevicePanel({ open, onClose, onCreated }: AddDevicePanelProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [type, setType] = useState<DeviceType>("bioreactor");
  const [name, setName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<ShareRole>("viewer");
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType("bioreactor");
    setName(t(DEVICE_TYPE_META.bioreactor.labelKey));
    setMemberEmail("");
    setMemberRole("viewer");
    setMembers([]);
    setError(null);
  }, [open, t]);

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

  const addMember = () => {
    const email = memberEmail.trim().toLowerCase();
    if (!email) return;
    if (members.some((m) => m.email === email)) {
      setError(t("addDevice.emailAlreadyListed"));
      return;
    }
    setMembers((prev) => [...prev, { email, role: memberRole }]);
    setMemberEmail("");
    setError(null);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const deviceId = await createMyDevice({
        type,
        name: name.trim(),
      });
      for (const member of members) {
        await inviteByEmail(deviceId, member.email, member.role);
      }
      onCreated(deviceId, type);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("addDevice.couldNotCreate"));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const meta = DEVICE_TYPE_META[type];

  return (
    <div
      className="add-device"
      ref={panelRef}
      role="dialog"
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
        <div className="add-device__types" role="listbox" aria-label={t("addDevice.type")}>
          {DEVICE_TYPE_ORDER.map((deviceType) => {
            const item = DEVICE_TYPE_META[deviceType];
            const Icon = item.Icon;
            const active = type === deviceType;
            const itemLabel = t(item.labelKey);
            return (
              <button
                key={deviceType}
                type="button"
                role="option"
                aria-selected={active}
                className={`add-device__type ${active ? "is-active" : ""}`}
                onClick={() => {
                  setType(deviceType);
                  setName((current) => {
                    const wasDefault = DEVICE_TYPE_ORDER.some(
                      (dt) => t(DEVICE_TYPE_META[dt].labelKey) === current
                    );
                    return wasDefault || !current.trim() ? itemLabel : current;
                  });
                }}
              >
                <span className="add-device__type-icon">
                  <Icon
                    color={active ? "var(--bv-accent-hover)" : "var(--bv-text)"}
                    height="18px"
                    width="18px"
                  />
                </span>
                <span className="add-device__type-label">{itemLabel}</span>
                {isLegacyDeviceType(deviceType) ? (
                  <span className="add-device__legacy">{t("common.legacy")}</span>
                ) : null}
              </button>
            );
          })}
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
        />

        <p className="add-device__label">{t("addDevice.assignMembers")}</p>
        <p className="add-device__hint">{t("addDevice.membersHint")}</p>
        <SegmentedControl
          aria-label={t("share.accessLevel")}
          shape="rounded"
          accent
          value={memberRole}
          onChange={(value) => setMemberRole(value as ShareRole)}
          options={SHARE_ROLE_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />
        <div className="add-device__member-row">
          <input
            type="email"
            className="add-device__input"
            placeholder={t("addDevice.emailPlaceholder")}
            value={memberEmail}
            onChange={(event) => setMemberEmail(event.target.value)}
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
            disabled={!memberEmail.trim()}
          >
            {t("addDevice.add")}
          </button>
        </div>

        {members.length > 0 && (
          <ul className="add-device__members">
            {members.map((member) => (
              <li key={member.email} className="add-device__member">
                <span>
                  {member.email}
                  <em>{member.role}</em>
                </span>
                <button
                  type="button"
                  className="add-device__remove"
                  onClick={() =>
                    setMembers((prev) =>
                      prev.filter((item) => item.email !== member.email)
                    )
                  }
                >
                  {t("common.remove")}
                </button>
              </li>
            ))}
          </ul>
        )}

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
  );
}

export default AddDevicePanel;

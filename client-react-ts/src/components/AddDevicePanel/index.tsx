import { FormEvent, useEffect, useRef, useState } from "react";
import { createMyDevice, type DeviceType } from "../../lib/devices";
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
    setName(DEVICE_TYPE_META.bioreactor.label);
    setMemberEmail("");
    setMemberRole("viewer");
    setMembers([]);
    setError(null);
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

  const addMember = () => {
    const email = memberEmail.trim().toLowerCase();
    if (!email) return;
    if (members.some((m) => m.email === email)) {
      setError("That email is already on the list");
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
      setError(err instanceof Error ? err.message : "Could not create device");
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
      aria-label="Add device"
    >
      <div className="add-device__head">
        <div>
          <p className="add-device__eyebrow">New device</p>
          <h2 className="add-device__title">Add a device</h2>
        </div>
        <button
          type="button"
          className="add-device__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form className="add-device__form" onSubmit={onSubmit}>
        <p className="add-device__label">Type</p>
        <div className="add-device__types" role="listbox" aria-label="Device type">
          {DEVICE_TYPE_ORDER.map((deviceType) => {
            const item = DEVICE_TYPE_META[deviceType];
            const Icon = item.Icon;
            const active = type === deviceType;
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
                      (t) => DEVICE_TYPE_META[t].label === current
                    );
                    return wasDefault || !current.trim()
                      ? item.label
                      : current;
                  });
                }}
              >
                <span className="add-device__type-icon">
                  <Icon
                    color={active ? "#0f766e" : "#1d1d1f"}
                    height="18px"
                    width="18px"
                  />
                </span>
                <span className="add-device__type-label">{item.label}</span>
              </button>
            );
          })}
        </div>
        <p className="add-device__hint">{meta.description}</p>

        <label className="add-device__label" htmlFor="add-device-name">
          Name
        </label>
        <input
          id="add-device-name"
          className="add-device__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={meta.label}
          maxLength={80}
          required
        />

        <p className="add-device__label">Assign members</p>
        <p className="add-device__hint">
          Optional. They need a Bioversee account and must accept from
          Notifications.
        </p>
        <SegmentedControl
          aria-label="Member role"
          shape="rounded"
          accent
          value={memberRole}
          onChange={(value) => setMemberRole(value as ShareRole)}
          options={SHARE_ROLE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
        <div className="add-device__member-row">
          <input
            type="email"
            className="add-device__input"
            placeholder="colleague@company.com"
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
            Add
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
                  Remove
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
          {busy ? "Creating…" : "Create device"}
        </button>
        {error && <p className="add-device__error">{error}</p>}
      </form>
    </div>
  );
}

export default AddDevicePanel;

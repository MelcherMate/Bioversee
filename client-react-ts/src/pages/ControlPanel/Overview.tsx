import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AddOutline } from "react-ionicons";
import {
  fetchDeviceCardSnapshots,
  listAccessibleDevicesInPlant,
  type AccessibleDevice,
  type DeviceCardSnapshot,
} from "../../lib/devices";
import {
  DEVICES_CHANGED_EVENT,
  requestOpenAddDevice,
} from "../../lib/onboarding";
import type { Plant } from "../../lib/plants";
import { listDeviceRoster } from "../../lib/sharing";
import DeviceCard from "./DeviceCard";
import PlantInfo, { type PlantPeople } from "./PlantInfo";

type OverviewProps = {
  plant: Plant | null;
  currentUserId: string;
  currentUserName: string;
  editing: boolean;
  titleFocusKey: number;
  onRename: (name: string) => Promise<void>;
};

const POLL_MS = 5000;

async function loadPlantPeople(
  plant: Plant,
  devices: AccessibleDevice[],
  managerFallbackName: string
): Promise<PlantPeople[]> {
  const byUser = new Map<string, PlantPeople>();

  byUser.set(plant.owner_id, {
    userId: plant.owner_id,
    displayName: managerFallbackName,
    avatarUrl: null,
    roles: ["owner"],
    isManager: true,
  });

  const owned = devices.filter((d) => d.isOwner);
  const rosters = await Promise.all(
    owned.map((d) => listDeviceRoster(d.id).catch(() => []))
  );

  for (const roster of rosters) {
    for (const member of roster) {
      const existing = byUser.get(member.user_id);
      const roles = new Set(existing?.roles ?? []);
      roles.add(member.role);
      byUser.set(member.user_id, {
        userId: member.user_id,
        displayName:
          member.display_name ||
          member.email ||
          existing?.displayName ||
          member.user_id.slice(0, 8),
        avatarUrl: member.avatar_url ?? existing?.avatarUrl ?? null,
        roles: [...roles],
        isManager:
          Boolean(existing?.isManager) ||
          member.user_id === plant.owner_id ||
          member.role === "owner",
      });
    }
  }

  return [...byUser.values()].sort((a, b) => {
    if (a.isManager !== b.isManager) return a.isManager ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

export default function Overview({
  plant,
  currentUserId,
  currentUserName,
  editing,
  titleFocusKey,
  onRename,
}: OverviewProps) {
  const { t } = useTranslation();
  const plantId = plant?.id ?? null;
  const [devices, setDevices] = useState<AccessibleDevice[]>([]);
  const [snapshots, setSnapshots] = useState<DeviceCardSnapshot[]>([]);
  const [people, setPeople] = useState<PlantPeople[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!plantId || !plant) {
      setDevices([]);
      setSnapshots([]);
      setPeople([]);
      setLoading(false);
      return;
    }
    try {
      const nextDevices = await listAccessibleDevicesInPlant(plantId);
      const nextSnaps = await fetchDeviceCardSnapshots(
        nextDevices.map((d) => d.id)
      );
      const managerName =
        plant.owner_id === currentUserId
          ? currentUserName || t("common.you")
          : t("controlPanel.plantManager");
      const nextPeople = await loadPlantPeople(
        plant,
        nextDevices,
        managerName
      );
      setDevices(nextDevices);
      setSnapshots(nextSnaps);
      setPeople(nextPeople);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [plant, plantId, currentUserId, currentUserName, t]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!plantId) return;
    const id = window.setInterval(() => {
      void load();
    }, POLL_MS);
    const onFocus = () => {
      void load();
    };
    const onDevicesChanged = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener(DEVICES_CHANGED_EVENT, onDevicesChanged);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(DEVICES_CHANGED_EVENT, onDevicesChanged);
    };
  }, [plantId, load]);

  if (!plant) {
    return (
      <div className="cp-empty">
        <p>{t("controlPanel.noPlant")}</p>
      </div>
    );
  }

  if (loading && devices.length === 0 && snapshots.length === 0) {
    return (
      <div className="cp-empty">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  if (error && devices.length === 0) {
    return (
      <div className="cp-empty">
        <p className="cp-empty__error">{error}</p>
      </div>
    );
  }

  return (
    <div className="cp-overview">
      <PlantInfo
        plant={plant}
        devices={devices}
        snapshots={snapshots}
        people={people}
        editing={editing}
        titleFocusKey={titleFocusKey}
        onRename={onRename}
      />

      <section
        className="cp-overview__devices"
        aria-label={t("controlPanel.deviceCards")}
      >
        <div className="cp-overview__devices-head">
          <h3 className="cp-overview__devices-title">
            {t("controlPanel.liveCards")}
          </h3>
        </div>

        {snapshots.length === 0 ? (
          <div className="cp-empty cp-empty--inline">
            <p className="cp-empty__eyebrow">{t("controlPanel.emptyEyebrow")}</p>
            <h2 className="cp-empty__title">{t("controlPanel.emptyTitle")}</h2>
            <p className="cp-empty__body">{t("controlPanel.emptyBody")}</p>
            <button
              type="button"
              className="cp-btn cp-btn--primary"
              onClick={() => requestOpenAddDevice("bioreactor")}
            >
              <AddOutline color="currentColor" height="18px" width="18px" />
              {t("controlPanel.addDevice")}
            </button>
          </div>
        ) : (
          <div className="cp-overview__grid">
            {snapshots.map((snap) => (
              <DeviceCard key={snap.id} snapshot={snap} />
            ))}
            <button
              type="button"
              className="cp-card cp-card--add"
              onClick={() => requestOpenAddDevice("bioreactor")}
            >
              <AddOutline
                color="var(--bv-accent-hover)"
                height="28px"
                width="28px"
              />
              <span>{t("controlPanel.addDevice")}</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

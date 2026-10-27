import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchDeviceCardSnapshots,
  listAccessibleDevicesInPlant,
  type AccessibleDevice,
  type DeviceCardSnapshot,
} from "../../lib/devices";
import { isPipeFittingDeviceType } from "../../lib/pipeFittings";
import { DEVICES_CHANGED_EVENT } from "../../lib/onboarding";
import type { Plant } from "../../lib/plants";
import { listPlantRoster } from "../../lib/sharing";
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
      const liveDevices = nextDevices.filter(
        (d) => !isPipeFittingDeviceType(d.type)
      );
      const nextSnaps = await fetchDeviceCardSnapshots(
        liveDevices.map((d) => d.id)
      );
      const roster = await listPlantRoster(plantId).catch(() => []);
      const nextPeople: PlantPeople[] =
        roster.length > 0
          ? roster.map((member) => ({
              memberId: member.member_id,
              userId: member.user_id,
              displayName:
                member.user_id === currentUserId
                  ? currentUserName || member.display_name
                  : member.display_name,
              avatarUrl: member.avatar_url,
              roles: [member.role],
              isManager: member.role === "owner" || member.role === "admin",
            }))
          : [
              {
                memberId: null,
                userId: currentUserId,
                displayName: currentUserName || t("common.owner"),
                avatarUrl: null,
                roles: [plant.role],
                isManager:
                  plant.role === "owner" || plant.role === "admin",
              },
            ];
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
        onPeopleChanged={load}
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
          </div>
        ) : (
          <div className="cp-overview__grid">
            {snapshots.map((snap) => (
              <DeviceCard key={snap.id} snapshot={snap} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import { insertSensorReadingsBulk, insertSliderState, insertSwitchState } from "./actuators";
import type { DeviceType } from "./devices";
import { listMyDevices } from "./devices";
import { mergeUserPreferences } from "./userSettings";

const LOCAL_KEY_PREFIX = "bv.onboarding.v1:";

export const DEVICES_CHANGED_EVENT = "bioversee:devices-changed";
export const OPEN_ADD_DEVICE_EVENT = "bioversee:open-add-device";

export function notifyDevicesChanged() {
  window.dispatchEvent(new Event(DEVICES_CHANGED_EVENT));
}

export function requestOpenAddDevice(type?: DeviceType) {
  window.dispatchEvent(
    new CustomEvent(OPEN_ADD_DEVICE_EVENT, { detail: { type } })
  );
}

export function isOnboardingDoneLocal(userId: string): boolean {
  try {
    return localStorage.getItem(`${LOCAL_KEY_PREFIX}${userId}`) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingDoneLocal(userId: string) {
  try {
    localStorage.setItem(`${LOCAL_KEY_PREFIX}${userId}`, "1");
  } catch {
    /* ignore */
  }
}

export async function markOnboardingCompleted(userId: string): Promise<void> {
  markOnboardingDoneLocal(userId);
  await mergeUserPreferences(userId, { onboardingCompleted: true });
}

/** True when the user already owns a device (skip intro). */
export async function userOwnsAnyDevice(): Promise<boolean> {
  const devices = await listMyDevices();
  return devices.length > 0;
}

type SensorSeries = {
  name: string;
  base: number;
  jitter: number;
  decimals?: number;
};

const SENSOR_SERIES: Record<DeviceType, SensorSeries[]> = {
  bioreactor: [
    { name: "temperature", base: 28.2, jitter: 1.2, decimals: 1 },
    { name: "ph", base: 6.85, jitter: 0.25, decimals: 2 },
    { name: "pressure", base: 14.7, jitter: 1.8, decimals: 1 },
  ],
  pressure_vessel: [{ name: "vesselLevel", base: 52, jitter: 8, decimals: 0 }],
  membrane_bioreactor: [
    { name: "mbrTankLevel", base: 92, jitter: 4, decimals: 0 },
  ],
  water_purifier: [{ name: "pufferwtlvl", base: 58, jitter: 10, decimals: 0 }],
};

function roundValue(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Writes 10 sensor samples per primary metric, spaced 1 minute apart
 * over the last 10 minutes, plus a sensible starting actuator state.
 */
export async function seedOnboardingSampleData(
  deviceId: string,
  type: DeviceType,
  userId: string
): Promise<void> {
  const now = Date.now();
  const series = SENSOR_SERIES[type];
  const rows: Array<{
    device_id: string;
    name: string;
    value: number;
    user_id: string | null;
    created_at: string;
    updated_at: string;
  }> = [];

  for (let i = 9; i >= 0; i -= 1) {
    const createdAt = new Date(now - i * 60_000).toISOString();
    for (const metric of series) {
      const drift = (Math.random() * 2 - 1) * metric.jitter;
      const value = roundValue(metric.base + drift, metric.decimals ?? 1);
      rows.push({
        device_id: deviceId,
        name: metric.name,
        value,
        user_id: userId,
        created_at: createdAt,
        updated_at: createdAt,
      });
    }
  }

  await insertSensorReadingsBulk(rows);

  // One-shot actuator baseline so controls are not empty.
  if (type === "bioreactor") {
    await insertSliderState(deviceId, "rotor", 45, userId);
    await insertSliderState(deviceId, "aerator", 55, userId);
    await insertSwitchState(deviceId, "switchWarmWaterPump", false, userId);
    await insertSwitchState(deviceId, "switchColdWaterPump", false, userId);
  } else if (type === "pressure_vessel") {
    const level = rows[rows.length - 1]?.value ?? 50;
    await insertSliderState(deviceId, "vesselLevel", level, userId);
  } else if (type === "membrane_bioreactor") {
    await insertSliderState(deviceId, "mbrAerationLevel", 50, userId);
    await insertSwitchState(deviceId, "mbrFlow", true, userId);
    await insertSwitchState(deviceId, "mbrAeration", true, userId);
  } else if (type === "water_purifier") {
    await insertSliderState(deviceId, "agitator", 40, userId);
    await insertSwitchState(deviceId, "switchPump1", false, userId);
  }
}

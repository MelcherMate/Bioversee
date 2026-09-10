import { supabase } from "./supabase";

export type DeviceType =
  | "bioreactor"
  | "pressure_vessel"
  | "membrane_bioreactor"
  | "water_purifier";

export type Device = {
  id: string;
  owner_id: string;
  type: DeviceType;
  name: string;
  created_at: string;
  updated_at: string;
};

const DEVICE_TYPES: DeviceType[] = [
  "bioreactor",
  "pressure_vessel",
  "membrane_bioreactor",
  "water_purifier",
];

/** Idempotent: creates the four default devices for the signed-in user. */
export async function ensureMyDevices(): Promise<void> {
  const { error } = await supabase.rpc("ensure_my_devices");
  if (error) throw error;
}

export async function listMyDevices(): Promise<Device[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("id, owner_id, type, name, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Device[];
}

/**
 * Returns the caller’s owned device of the given type.
 * Ensures defaults exist first so first login always has a device.
 */
export async function getMyDevice(type: DeviceType): Promise<Device> {
  await ensureMyDevices();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("devices")
    .select("id, owner_id, type, name, created_at, updated_at")
    .eq("type", type)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(`No ${type} device found for this user`);
  }
  return data as Device;
}

/**
 * Resolve the device for a process page.
 * If `preferredId` is set and the user can access it (RLS), use that
 * (shared devices via invite). Otherwise fall back to the owned default.
 */
export async function getDeviceForPage(
  type: DeviceType,
  preferredId?: string | null
): Promise<Device> {
  if (preferredId) {
    const { data, error } = await supabase
      .from("devices")
      .select("id, owner_id, type, name, created_at, updated_at")
      .eq("id", preferredId)
      .eq("type", type)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as Device;
  }

  return getMyDevice(type);
}

export async function getMyDevicesByType(): Promise<
  Partial<Record<DeviceType, Device>>
> {
  await ensureMyDevices();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("devices")
    .select("id, owner_id, type, name, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const byType: Partial<Record<DeviceType, Device>> = {};
  for (const device of (data ?? []) as Device[]) {
    if (!byType[device.type]) {
      byType[device.type] = device;
    }
  }
  for (const type of DEVICE_TYPES) {
    if (!byType[type]) {
      throw new Error(`Missing provisioned device: ${type}`);
    }
  }
  return byType;
}

export { DEVICE_TYPES };

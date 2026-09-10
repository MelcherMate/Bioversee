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

export async function listAccessibleDevices(): Promise<
  Array<Device & { role: string; isOwner: boolean }>
> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Not authenticated");

  await ensureMyDevices();

  const { data: memberships, error: memberError } = await supabase
    .from("device_members")
    .select("device_id, role")
    .eq("user_id", user.id);

  if (memberError) throw memberError;

  const ids = [...new Set((memberships ?? []).map((row) => row.device_id))];
  if (ids.length === 0) return [];

  const roleByDevice = new Map(
    (memberships ?? []).map((row) => [row.device_id, row.role])
  );

  const { data, error } = await supabase
    .from("devices")
    .select("id, owner_id, type, name, created_at, updated_at")
    .in("id", ids)
    .order("name", { ascending: true });

  if (error) throw error;

  const typeOrder = new Map(DEVICE_TYPES.map((type, index) => [type, index]));

  return ((data ?? []) as Device[])
    .map((device) => ({
      ...device,
      role: roleByDevice.get(device.id) ?? "viewer",
      isOwner: device.owner_id === user.id,
    }))
    .sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      const typeDiff =
        (typeOrder.get(a.type) ?? 99) - (typeOrder.get(b.type) ?? 99);
      if (typeDiff !== 0) return typeDiff;
      return a.name.localeCompare(b.name);
    });
}

export async function createMyDevice(input: {
  type: DeviceType;
  name: string;
  memberEmails?: string[];
  memberRole?: "admin" | "operator" | "viewer";
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_my_device", {
    p_type: input.type,
    p_name: input.name,
    p_member_emails: input.memberEmails ?? [],
    p_member_role: input.memberRole ?? "viewer",
  });
  if (error) throw error;
  if (!data || typeof data !== "string") {
    throw new Error("Failed to create device");
  }
  return data;
}

export async function deleteMyDevice(deviceId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_my_device", {
    p_device_id: deviceId,
  });
  if (error) throw error;
}

export async function renameMyDevice(
  deviceId: string,
  name: string
): Promise<void> {
  const { error } = await supabase.rpc("rename_my_device", {
    p_device_id: deviceId,
    p_name: name,
  });
  if (error) throw error;
}

export async function leaveDevice(deviceId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_device", {
    p_device_id: deviceId,
  });
  if (error) throw error;
}

export function isLegacyDeviceType(type: DeviceType): boolean {
  return type === "bioreactor" || type === "water_purifier";
}

export { DEVICE_TYPES };

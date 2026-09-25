import { supabase } from "./supabase";
import { avatarForAccount } from "./accountSessions";

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

export type DeviceWithAccess = Device & {
  role: string;
  isOwner: boolean;
};

export type AccessibleDevice = DeviceWithAccess & {
  ownerDisplayName: string | null;
  ownerAvatarUrl: string | null;
};

/** Owner / admin / operator may write actuators. Viewers are read-only. */
export function canOperateDevice(role: string): boolean {
  return role === "owner" || role === "admin" || role === "operator";
}

/** Owner / admin may manage sharing and rename. */
export function canAdminDevice(role: string): boolean {
  return role === "owner" || role === "admin";
}

const DEVICE_TYPES: DeviceType[] = [
  "bioreactor",
  "pressure_vessel",
  "membrane_bioreactor",
  "water_purifier",
];

export async function listMyDevices(): Promise<Device[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("id, owner_id, type, name, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Device[];
}

/**
 * Returns the caller’s owned device of the given type, or null if none.
 */
export async function getMyDevice(type: DeviceType): Promise<Device | null> {
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
  return (data as Device | null) ?? null;
}

async function withMembership(
  device: Device
): Promise<DeviceWithAccess | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Not authenticated");

  const { data: membership, error } = await supabase
    .from("device_members")
    .select("role")
    .eq("device_id", device.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!membership) return null;

  return {
    ...device,
    role: membership.role,
    isOwner: device.owner_id === user.id,
  };
}

/**
 * Resolve the device for a process page.
 * Prefer `preferredId` when accessible. If a preferred id was requested but is
 * no longer accessible, return null (caller should redirect) — do not silently
 * fall back to another device while the URL still points at the lost one.
 * With no preferred id, use the first owned device of that type.
 */
export async function getDeviceForPage(
  type: DeviceType,
  preferredId?: string | null
): Promise<DeviceWithAccess | null> {
  if (preferredId) {
    const { data, error } = await supabase
      .from("devices")
      .select("id, owner_id, type, name, created_at, updated_at")
      .eq("id", preferredId)
      .eq("type", type)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return withMembership(data as Device);
  }

  const owned = await getMyDevice(type);
  if (!owned) return null;
  return withMembership(owned);
}

/** Owned devices keyed by type (first of each). Missing types are omitted. */
export async function getMyDevicesByType(): Promise<
  Partial<Record<DeviceType, Device>>
> {
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
  return byType;
}

export async function listAccessibleDevices(): Promise<AccessibleDevice[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Not authenticated");

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

  const devices = (data ?? []) as Device[];
  const ownerIds = [
    ...new Set(
      devices.filter((device) => device.owner_id !== user.id).map((d) => d.owner_id)
    ),
  ];

  const ownerById = new Map<
    string,
    { display_name: string | null; avatar_url: string | null }
  >();

  if (ownerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", ownerIds);
    if (profileError) throw profileError;
    for (const profile of profiles ?? []) {
      ownerById.set(profile.id, {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      });
    }
  }

  const typeOrder = new Map(DEVICE_TYPES.map((type, index) => [type, index]));

  return devices
    .map((device) => {
      const owner = ownerById.get(device.owner_id);
      return {
        ...device,
        role: roleByDevice.get(device.id) ?? "viewer",
        isOwner: device.owner_id === user.id,
        ownerDisplayName: owner?.display_name ?? null,
        ownerAvatarUrl: owner?.avatar_url ?? null,
      };
    })
    .sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      const typeDiff =
        (typeOrder.get(a.type) ?? 99) - (typeOrder.get(b.type) ?? 99);
      if (typeDiff !== 0) return typeDiff;
      return a.name.localeCompare(b.name);
    });
}

export function ownerAvatarSrc(device: AccessibleDevice): string {
  return avatarForAccount({
    displayName: device.ownerDisplayName || device.name,
    avatarUrl: device.ownerAvatarUrl,
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
  return type === "water_purifier";
}

export function isNewDeviceType(type: DeviceType): boolean {
  return type === "bioreactor";
}

export { DEVICE_TYPES };

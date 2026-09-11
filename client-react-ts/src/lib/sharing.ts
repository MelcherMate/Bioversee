import i18n from "../i18n";
import { supabase } from "./supabase";
import type { Device, DeviceType } from "./devices";
import type { DeviceMemberRole } from "./database.types";

export type ShareRole = Exclude<DeviceMemberRole, "owner">;

export type DeviceRosterMember = {
  member_id: string;
  user_id: string;
  role: DeviceMemberRole;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
};

export type RedeemResult = {
  status?: "pending" | "already_member";
  invite_id?: string;
  device_id: string;
  type: DeviceType;
  name: string;
  role: ShareRole;
};

export type ShareLinkRow = {
  id: string;
  device_id: string;
  token: string;
  role: ShareRole;
  expires_at: string | null;
  revoked_at: string | null;
  use_count: number;
  max_uses: number | null;
  created_at: string;
};

const PATH_BY_TYPE: Record<DeviceType, string> = {
  bioreactor: "/bioreactor",
  pressure_vessel: "/pressure-vessel",
  membrane_bioreactor: "/membrane-bioreactor",
  water_purifier: "/waterpurifier",
};

export function pathForDeviceType(type: DeviceType): string {
  return PATH_BY_TYPE[type];
}

export function deviceTypeFromPath(pathname: string): DeviceType | null {
  switch (pathname) {
    case "/bioreactor":
      return "bioreactor";
    case "/pressure-vessel":
      return "pressure_vessel";
    case "/membrane-bioreactor":
      return "membrane_bioreactor";
    case "/waterpurifier":
      return "water_purifier";
    default:
      return null;
  }
}

export function inviteUrlForToken(token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${token}`;
}

export function openSharedDeviceUrl(device: Pick<Device, "id" | "type">): string {
  return `${pathForDeviceType(device.type)}?device=${device.id}`;
}

/** Path to open after the current `?device=` is no longer accessible. */
export function fallbackPathAfterLostDevice(
  devices: Array<Pick<Device, "id" | "type">>,
  routeType: DeviceType | null
): string {
  const sameType =
    (routeType && devices.find((device) => device.type === routeType)) || null;
  if (sameType) {
    return `${pathForDeviceType(sameType.type)}?device=${sameType.id}`;
  }
  const first = devices[0];
  if (first) {
    return `${pathForDeviceType(first.type)}?device=${first.id}`;
  }
  return routeType ? pathForDeviceType(routeType) : "/bioreactor";
}

/** Devices the caller can admin (owner/admin membership). */
export async function listShareableDevices(): Promise<Device[]> {
  const { data: memberships, error: memberError } = await supabase
    .from("device_members")
    .select("device_id, role")
    .in("role", ["owner", "admin"]);

  if (memberError) throw memberError;

  const ids = [...new Set((memberships ?? []).map((row) => row.device_id))];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("devices")
    .select("id, owner_id, type, name, created_at, updated_at")
    .in("id", ids)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Device[];
}

export function roleLabel(role: string): string {
  switch (role) {
    case "owner":
      return i18n.t("common.owner");
    case "admin":
      return i18n.t("common.admin");
    case "operator":
      return i18n.t("common.operator");
    case "viewer":
      return i18n.t("common.viewer");
    default:
      return role;
  }
}

export async function createShareLink(
  deviceId: string,
  role: ShareRole,
  expiresHours = 168
): Promise<string> {
  const { data, error } = await supabase.rpc("create_device_share_link", {
    p_device_id: deviceId,
    p_role: role,
    p_expires_hours: expiresHours,
    p_max_uses: null,
  });
  if (error) throw error;
  if (!data || typeof data !== "string") {
    throw new Error("Failed to create share link");
  }
  return data;
}

export async function redeemShareLink(token: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc("redeem_device_share_link", {
    p_token: token,
  });
  if (error) throw error;
  const result = data as RedeemResult | null;
  if (!result?.device_id || !result.type) {
    throw new Error("Invalid redeem response");
  }
  return result;
}

export async function inviteByEmail(
  deviceId: string,
  email: string,
  role: ShareRole
): Promise<void> {
  const { error } = await supabase.rpc("invite_device_member_by_email", {
    p_device_id: deviceId,
    p_email: email,
    p_role: role,
  });
  if (error) throw error;
}

export async function listDeviceRoster(
  deviceId: string
): Promise<DeviceRosterMember[]> {
  const { data, error } = await supabase.rpc("list_device_roster", {
    p_device_id: deviceId,
  });
  if (error) throw error;
  return (data ?? []) as DeviceRosterMember[];
}

export async function updateMemberRole(
  memberId: string,
  role: ShareRole
): Promise<void> {
  const { error } = await supabase
    .from("device_members")
    .update({ role })
    .eq("id", memberId)
    .neq("role", "owner");
  if (error) throw error;
}

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("device_members")
    .delete()
    .eq("id", memberId)
    .neq("role", "owner");
  if (error) throw error;
}

export async function listActiveShareLinks(
  deviceId: string
): Promise<ShareLinkRow[]> {
  const { data, error } = await supabase
    .from("device_share_links")
    .select(
      "id, device_id, token, role, expires_at, revoked_at, use_count, max_uses, created_at"
    )
    .eq("device_id", deviceId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ShareLinkRow[];
}

export async function revokeShareLink(linkId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_device_share_link", {
    p_link_id: linkId,
  });
  if (error) throw error;
}

export const SHARE_ROLE_OPTIONS: {
  value: ShareRole;
  labelKey: string;
  hintKey: string;
}[] = [
  {
    value: "viewer",
    labelKey: "roles.viewer",
    hintKey: "roles.viewerHint",
  },
  {
    value: "operator",
    labelKey: "roles.operator",
    hintKey: "roles.operatorHint",
  },
  {
    value: "admin",
    labelKey: "roles.admin",
    hintKey: "roles.adminHint",
  },
];

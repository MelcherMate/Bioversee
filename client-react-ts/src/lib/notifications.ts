import { supabase } from "./supabase";
import type { DeviceType } from "./devices";
import type { ShareRole } from "./sharing";

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  data: {
    invite_id?: string;
    device_id?: string;
    device_name?: string;
    device_type?: DeviceType;
    role?: ShareRole;
    inviter_id?: string;
    inviter_name?: string;
    resolved?: string;
    [key: string]: unknown;
  };
  read_at: string | null;
  created_at: string;
  invite_status: string | null;
};

export type AcceptInviteResult = {
  device_id: string;
  type: DeviceType;
  name: string;
  role: ShareRole;
};

export async function listMyNotifications(
  limit = 40
): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc("list_my_notifications", {
    p_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as AppNotification[]).map((row) => ({
    ...row,
    data: (row.data ?? {}) as AppNotification["data"],
  }));
}

export async function acceptDeviceInvite(
  inviteId: string
): Promise<AcceptInviteResult> {
  const { data, error } = await supabase.rpc("accept_device_invite", {
    p_invite_id: inviteId,
  });
  if (error) throw error;
  const result = data as AcceptInviteResult | null;
  if (!result?.device_id) throw new Error("Accept failed");
  return result;
}

export async function declineDeviceInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_device_invite", {
    p_invite_id: inviteId,
  });
  if (error) throw error;
}

export async function markNotificationRead(
  notificationId: string
): Promise<void> {
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) throw error;
}

export function unreadCount(notifications: AppNotification[]): number {
  return notifications.filter((n) => {
    if (n.kind === "device_invite" && n.invite_status === "pending") return true;
    return !n.read_at;
  }).length;
}

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
    plant_id?: string;
    plant_name?: string;
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
  plant_id?: string;
  device_id?: string;
  type?: DeviceType;
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

export async function acceptInvite(
  inviteId: string,
  kind: string
): Promise<AcceptInviteResult> {
  const rpc =
    kind === "plant_invite" ? "accept_plant_invite" : "accept_device_invite";
  const { data, error } = await supabase.rpc(rpc, {
    p_invite_id: inviteId,
  });
  if (error) throw error;
  const result = data as AcceptInviteResult | null;
  if (!result?.name) throw new Error("Accept failed");
  return result;
}

export async function declineInvite(
  inviteId: string,
  kind: string
): Promise<void> {
  const rpc =
    kind === "plant_invite" ? "decline_plant_invite" : "decline_device_invite";
  const { error } = await supabase.rpc(rpc, {
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

export async function deleteNotification(
  notificationId: string
): Promise<void> {
  const { error } = await supabase.rpc("delete_my_notification", {
    p_notification_id: notificationId,
  });
  if (error) throw error;
}

export function isPendingInviteNotification(
  notification: AppNotification
): boolean {
  if (
    (notification.kind !== "device_invite" &&
      notification.kind !== "plant_invite") ||
    !notification.data.invite_id
  ) {
    return false;
  }
  if (notification.data.resolved) return false;
  return (
    notification.invite_status === "pending" ||
    notification.invite_status == null
  );
}

export function unreadCount(notifications: AppNotification[]): number {
  return notifications.filter((n) => {
    if (isPendingInviteNotification(n)) return true;
    return !n.read_at;
  }).length;
}

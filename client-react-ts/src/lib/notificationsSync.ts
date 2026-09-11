import { supabase } from "./supabase";

export const NOTIFICATIONS_CHANGED_EVENT = "bv:notifications-changed";

export function emitNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

/**
 * Live sync for the signed-in user's notifications.
 * Prefers Supabase Realtime; always keeps a short poll as backup.
 */
export function subscribeMyNotifications(
  userId: string,
  onChange: () => void
): () => void {
  let disposed = false;

  const notify = () => {
    if (disposed) return;
    onChange();
    emitNotificationsChanged();
  };

  const channel = supabase
    .channel(`notifications-sync:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      () => notify()
    )
    .subscribe();

  // Backup if Realtime isn't enabled yet / brief disconnects.
  const interval = window.setInterval(notify, 5000);

  return () => {
    disposed = true;
    window.clearInterval(interval);
    void supabase.removeChannel(channel);
  };
}

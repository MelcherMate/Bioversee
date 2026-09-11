import { supabase } from "./supabase";
import { DEVICES_CHANGED_EVENT } from "./onboarding";

export function emitDevicesChanged() {
  window.dispatchEvent(new Event(DEVICES_CHANGED_EVENT));
}

/**
 * Live sync for the signed-in user's device memberships / devices.
 * Prefers Supabase Realtime; keeps a short poll as backup.
 */
export function subscribeMyDevices(
  userId: string,
  onChange: () => void
): () => void {
  let disposed = false;

  const notify = () => {
    if (disposed) return;
    onChange();
  };

  const channel = supabase
    .channel(`devices-sync:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "device_members",
        filter: `user_id=eq.${userId}`,
      },
      () => notify()
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "devices",
      },
      () => notify()
    )
    .subscribe();

  const interval = window.setInterval(notify, 2000);

  return () => {
    disposed = true;
    window.clearInterval(interval);
    void supabase.removeChannel(channel);
  };
}

import { supabase } from "./supabase";

export type ActuatorChange = {
  kind: "switch" | "slider";
  name: string;
  state: boolean | number;
  userId: string | null;
};

type ActuatorRow = {
  name?: string;
  state?: boolean | number | string;
  user_id?: string | null;
};

type Listener = (change?: ActuatorChange) => void;

type DeviceHub = {
  listeners: Set<Listener>;
  unsubscribeChannel: () => void;
};

const hubs = new Map<string, DeviceHub>();

function parseSwitchState(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase();
    if (v === "true" || v === "t" || v === "1") return true;
    if (v === "false" || v === "f" || v === "0") return false;
  }
  return Boolean(raw);
}

function parseRow(
  kind: ActuatorChange["kind"],
  row: ActuatorRow | undefined,
): ActuatorChange | undefined {
  if (!row?.name) return undefined;
  const raw = row.state;
  if (raw === undefined || raw === null) return undefined;
  const state =
    kind === "switch" ? parseSwitchState(raw) : Number(raw);
  if (kind === "slider" && !Number.isFinite(state as number)) return undefined;
  return {
    kind,
    name: String(row.name),
    state,
    userId: row.user_id ?? null,
  };
}

async function ensureRealtimeAuth() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    await supabase.realtime.setAuth(data.session.access_token);
  }
}

function ensureHub(deviceId: string): DeviceHub {
  const id = deviceId.toLowerCase();
  const existing = hubs.get(id);
  if (existing) return existing;

  const listeners = new Set<Listener>();

  const notify = (change?: ActuatorChange) => {
    for (const listener of listeners) listener(change);
  };

  const channel = supabase
    .channel(`actuators-sync:${id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "actuator_switches",
        filter: `device_id=eq.${id}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as ActuatorRow | undefined;
        notify(parseRow("switch", row));
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "actuator_sliders",
        filter: `device_id=eq.${id}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as ActuatorRow | undefined;
        notify(parseRow("slider", row));
      },
    );

  void ensureRealtimeAuth().then(() => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") return;
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[actuators] realtime status:", status);
      }
    });
  });

  // Backup if Realtime JWT/RLS drops events (common after cold session restore).
  const interval = window.setInterval(() => notify(), 1000);

  const onVisible = () => {
    if (document.visibilityState === "visible") notify();
  };
  document.addEventListener("visibilitychange", onVisible);

  const hub: DeviceHub = {
    listeners,
    unsubscribeChannel: () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    },
  };
  hubs.set(id, hub);
  return hub;
}

/**
 * Live sync for one device's switches + sliders.
 * Shared per deviceId so multiple controls reuse one Realtime channel.
 */
export function subscribeDeviceActuators(
  deviceId: string,
  onChange: Listener,
): () => void {
  const id = deviceId.toLowerCase();
  const hub = ensureHub(id);
  hub.listeners.add(onChange);

  return () => {
    hub.listeners.delete(onChange);
    if (hub.listeners.size === 0) {
      hub.unsubscribeChannel();
      hubs.delete(id);
    }
  };
}

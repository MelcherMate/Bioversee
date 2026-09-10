import { supabase } from "./supabase";

export async function getLatestSliderState(
  deviceId: string,
  name: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("actuator_sliders")
    .select("state")
    .eq("device_id", deviceId)
    .eq("name", name)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? Number(data.state) : 0;
}

export async function insertSliderState(
  deviceId: string,
  name: string,
  state: number,
  userId: string,
) {
  const { error } = await supabase.from("actuator_sliders").insert({
    device_id: deviceId,
    name,
    state,
    user_id: userId,
  });
  if (error) throw error;
}

export async function getLatestSwitchState(
  deviceId: string,
  name: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("actuator_switches")
    .select("state")
    .eq("device_id", deviceId)
    .eq("name", name)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? Boolean(data.state) : false;
}

export async function insertSwitchState(
  deviceId: string,
  name: string,
  state: boolean,
  userId: string,
) {
  const { error } = await supabase.from("actuator_switches").insert({
    device_id: deviceId,
    name,
    state,
    user_id: userId,
  });
  if (error) throw error;
}

export type SensorReading = {
  name: string;
  value: number;
  created_at: string;
};

export async function getSensorReadings(
  deviceId: string,
  name: string,
): Promise<SensorReading[]> {
  const { data, error } = await supabase
    .from("sensors")
    .select("name, value, created_at")
    .eq("device_id", deviceId)
    .eq("name", name)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    name: row.name,
    value: Number(row.value),
    created_at: row.created_at,
  }));
}

export async function insertSensorReading(
  deviceId: string,
  name: string,
  value: number,
  userId?: string,
) {
  const { error } = await supabase.from("sensors").insert({
    device_id: deviceId,
    name,
    value,
    user_id: userId ?? null,
  });
  if (error) throw error;
}

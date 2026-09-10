import { supabase } from "./supabase";

export async function getLatestSliderState(name: string): Promise<number> {
  const { data, error } = await supabase
    .from("actuator_sliders")
    .select("state")
    .eq("name", name)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? Number(data.state) : 0;
}

export async function insertSliderState(
  name: string,
  state: number,
  userId: string
) {
  const { error } = await supabase.from("actuator_sliders").insert({
    name,
    state,
    user_id: userId,
  });
  if (error) throw error;
}

export async function getLatestSwitchState(name: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("actuator_switches")
    .select("state")
    .eq("name", name)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? Boolean(data.state) : false;
}

export async function insertSwitchState(
  name: string,
  state: boolean,
  userId: string
) {
  const { error } = await supabase.from("actuator_switches").insert({
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
  name: string
): Promise<SensorReading[]> {
  const { data, error } = await supabase
    .from("sensors")
    .select("name, value, created_at")
    .eq("name", name)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    name: row.name,
    value: Number(row.value),
    created_at: row.created_at,
  }));
}

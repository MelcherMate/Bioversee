import { supabase } from "./supabase";

export type PlantConnection = {
  id: string;
  plant_id: string;
  source_device_id: string;
  target_device_id: string;
  created_at: string;
};

export type PlantNodeLayout = {
  plant_id: string;
  device_id: string;
  x: number;
  y: number;
  updated_at: string;
};

export async function listPlantConnections(
  plantId: string
): Promise<PlantConnection[]> {
  const { data, error } = await supabase
    .from("plant_connections")
    .select("id, plant_id, source_device_id, target_device_id, created_at")
    .eq("plant_id", plantId);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    plant_id: String(row.plant_id),
    source_device_id: String(row.source_device_id),
    target_device_id: String(row.target_device_id),
    created_at: String(row.created_at),
  }));
}

export async function createPlantConnection(input: {
  plantId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
}): Promise<PlantConnection> {
  const { data, error } = await supabase
    .from("plant_connections")
    .insert({
      plant_id: input.plantId,
      source_device_id: input.sourceDeviceId,
      target_device_id: input.targetDeviceId,
    })
    .select("id, plant_id, source_device_id, target_device_id, created_at")
    .single();

  if (error) throw error;
  return {
    id: String(data.id),
    plant_id: String(data.plant_id),
    source_device_id: String(data.source_device_id),
    target_device_id: String(data.target_device_id),
    created_at: String(data.created_at),
  };
}

export async function deletePlantConnection(connectionId: string): Promise<void> {
  const { error } = await supabase
    .from("plant_connections")
    .delete()
    .eq("id", connectionId);
  if (error) throw error;
}

export async function listPlantLayouts(
  plantId: string
): Promise<PlantNodeLayout[]> {
  const { data, error } = await supabase
    .from("plant_node_layouts")
    .select("plant_id, device_id, x, y, updated_at")
    .eq("plant_id", plantId);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    plant_id: String(row.plant_id),
    device_id: String(row.device_id),
    x: Number(row.x),
    y: Number(row.y),
    updated_at: String(row.updated_at),
  }));
}

export async function upsertPlantLayout(input: {
  plantId: string;
  deviceId: string;
  x: number;
  y: number;
}): Promise<void> {
  const { error } = await supabase.from("plant_node_layouts").upsert(
    {
      plant_id: input.plantId,
      device_id: input.deviceId,
      x: input.x,
      y: input.y,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "plant_id,device_id" }
  );
  if (error) throw error;
}

import { supabase } from "./supabase";

export type Plant = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

function mapPlant(row: Record<string, unknown>): Plant {
  return {
    id: String(row.id),
    owner_id: String(row.owner_id),
    name: String(row.name),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listMyPlants(): Promise<Plant[]> {
  const { data, error } = await supabase
    .from("plants")
    .select("id, owner_id, name, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapPlant(row as Record<string, unknown>));
}

export async function ensureMyDefaultPlant(): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_my_default_plant");
  if (error) throw error;
  if (!data || typeof data !== "string") {
    throw new Error("Failed to ensure default plant");
  }
  return data;
}

export async function createMyPlant(name: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_my_plant", {
    p_name: name,
  });
  if (error) throw error;
  if (!data || typeof data !== "string") {
    throw new Error("Failed to create plant");
  }
  return data;
}

export async function renameMyPlant(plantId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc("rename_my_plant", {
    p_plant_id: plantId,
    p_name: name,
  });
  if (error) throw error;
}

export async function deleteMyPlant(plantId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_my_plant", {
    p_plant_id: plantId,
  });
  if (error) throw error;
}

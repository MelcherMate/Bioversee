import type { DeviceMemberRole } from "./database.types";
import { supabase } from "./supabase";

export type Plant = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  /** Caller's membership on this plant. */
  role: DeviceMemberRole;
};

export function canAdminPlant(role: string): boolean {
  return role === "owner" || role === "admin";
}

function mapPlant(row: Record<string, unknown>): Plant {
  const role = String(row.role ?? "viewer") as DeviceMemberRole;
  return {
    id: String(row.id),
    owner_id: String(row.owner_id),
    name: String(row.name),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    role:
      role === "owner" || role === "admin" || role === "operator"
        ? role
        : "viewer",
  };
}

function isMissingRpc(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const message = error.message ?? "";
  return (
    code === "PGRST202" ||
    /could not find the function/i.test(message)
  );
}

export async function listMyPlants(): Promise<Plant[]> {
  const { data, error } = await supabase.rpc("list_my_plants");
  if (!error) {
    return (data ?? []).map((row) => mapPlant(row as Record<string, unknown>));
  }
  if (!isMissingRpc(error)) throw error;

  const { data: rows, error: tableError } = await supabase
    .from("plants")
    .select("id, owner_id, name, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (tableError) throw tableError;
  return (rows ?? []).map((row) =>
    mapPlant({ ...(row as Record<string, unknown>), role: "owner" })
  );
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

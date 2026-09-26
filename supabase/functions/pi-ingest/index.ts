// Supabase Edge Function: pi-ingest
// Deploy: supabase functions deploy pi-ingest --no-verify-jwt
// Auth: X-Device-Key: bvpi_...  (or Authorization: Bearer bvpi_...)
//
// POST body actions:
//   { "action": "sensors", "readings": [{ "name": "temperature", "value": 28.1 }, ...] }
//   { "action": "actuators" }  → latest slider/switch states for the device
//   { "action": "config", "config": { "pi": { "wiring": [...] } } }  → merge devices.config
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    const apiKey = extractApiKey(req);
    if (!apiKey) {
      return json({ ok: false, error: "Missing device API key" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: deviceId, error: verifyError } = await supabase.rpc(
      "verify_device_credential",
      { p_api_key: apiKey },
    );

    if (verifyError) {
      console.error("verify_device_credential", verifyError);
      return json({ ok: false, error: verifyError.message }, 500);
    }
    if (!deviceId) {
      return json({ ok: false, error: "Invalid or revoked device key" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = (body.action as string | undefined) ?? "sensors";

    if (action === "sensors") {
      const readings = Array.isArray(body.readings) ? body.readings : [];
      if (!readings.length) {
        return json({ ok: false, error: "readings required" }, 400);
      }

      const rows = readings.map(
        (r: { name?: string; value?: number; created_at?: string }) => ({
          device_id: deviceId,
          name: String(r.name ?? ""),
          value: Number(r.value),
          user_id: null,
          ...(r.created_at ? { created_at: r.created_at, updated_at: r.created_at } : {}),
        }),
      );

      for (const row of rows) {
        if (!row.name || Number.isNaN(row.value)) {
          return json({ ok: false, error: "Each reading needs name and numeric value" }, 400);
        }
      }

      const { error } = await supabase.from("sensors").insert(rows);
      if (error) {
        console.error("sensors insert", error);
        return json({ ok: false, error: error.message }, 500);
      }
      return json({ ok: true, inserted: rows.length, device_id: deviceId }, 200);
    }

    if (action === "actuators") {
      const [sliders, switches] = await Promise.all([
        latestByName(supabase, "actuator_sliders", deviceId as string, "state"),
        latestByName(supabase, "actuator_switches", deviceId as string, "state"),
      ]);
      return json(
        {
          ok: true,
          device_id: deviceId,
          sliders,
          switches,
        },
        200,
      );
    }

    if (action === "config") {
      const patch = body.config;
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return json({ ok: false, error: "config object required" }, 400);
      }

      const { data: device, error: fetchError } = await supabase
        .from("devices")
        .select("config")
        .eq("id", deviceId)
        .maybeSingle();

      if (fetchError) {
        return json({ ok: false, error: fetchError.message }, 500);
      }

      const current =
        device?.config && typeof device.config === "object" && !Array.isArray(device.config)
          ? (device.config as Record<string, unknown>)
          : {};
      const merged = deepMerge(current, patch as Record<string, unknown>);

      const { data: updated, error: updateError } = await supabase
        .from("devices")
        .update({ config: merged })
        .eq("id", deviceId)
        .select("config")
        .maybeSingle();

      if (updateError) {
        return json({ ok: false, error: updateError.message }, 500);
      }
      return json({ ok: true, device_id: deviceId, config: updated?.config ?? merged }, 200);
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function extractApiKey(req: Request): string | null {
  const headerKey = req.headers.get("X-Device-Key");
  if (headerKey?.trim()) return headerKey.trim();
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token.startsWith("bvpi_")) return token;
  }
  return null;
}

async function latestByName(
  supabase: ReturnType<typeof createClient>,
  table: "actuator_sliders" | "actuator_switches",
  deviceId: string,
  valueCol: string,
): Promise<Record<string, number | boolean>> {
  const { data, error } = await supabase
    .from(table)
    .select(`name, ${valueCol}, created_at`)
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  const out: Record<string, number | boolean> = {};
  for (const row of data ?? []) {
    const name = String((row as { name: string }).name);
    if (name in out) continue;
    out[name] = (row as Record<string, number | boolean>)[valueCol];
  }
  return out;
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      out[key] &&
      typeof out[key] === "object" &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(
        out[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

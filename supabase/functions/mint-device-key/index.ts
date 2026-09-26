// Supabase Edge Function: mint-device-key
// Deploy: supabase functions deploy mint-device-key
// Auth: caller's JWT (Authorization: Bearer <user access_token>)
// Body: { device_id: uuid, label?: string }
// Returns: { credential_id, device_id, api_key, label }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Missing Authorization bearer token" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ ok: false, error: "Invalid session" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const deviceId = body.device_id as string | undefined;
    const label = (body.label as string | undefined) ?? "Raspberry Pi";

    if (!deviceId) {
      return json({ ok: false, error: "device_id required" }, 400);
    }

    const { data, error } = await userClient.rpc("mint_device_credential", {
      p_device_id: deviceId,
      p_label: label,
    });

    if (error) {
      console.error("mint_device_credential", error);
      return json({ ok: false, error: error.message }, 403);
    }

    return json({ ok: true, ...(data as Record<string, unknown>) }, 200);
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

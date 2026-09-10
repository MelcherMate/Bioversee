// Supabase Edge Function: push-notify
// Deploy: supabase functions deploy push-notify --no-verify-jwt
// Wire: Dashboard → Database → Webhooks → INSERT on public.notifications → this function
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID=com.bioversee.app
//   APNS_P8  (contents of AuthKey_XXXX.p8, newlines as \n)
//   APNS_PRODUCTION=false for sandbox / TestFlight; true for App Store

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APNS_HOST =
  Deno.env.get("APNS_PRODUCTION") === "true"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const row = payload.record ?? payload;
    const userId = row.user_id as string | undefined;
    const title = (row.title as string) ?? "Bioversee";
    const body = (row.body as string) ?? "";

    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: "missing user_id" }), {
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tokens, error } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", userId);

    if (error) throw error;
    if (!tokens?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    }

    const jwt = await buildApnsJwt();
    const bundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "com.bioversee.app";
    let sent = 0;

    for (const rowToken of tokens) {
      if (rowToken.platform !== "ios") continue;
      const res = await fetch(`${APNS_HOST}/3/device/${rowToken.token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": bundleId,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          aps: {
            alert: { title, body },
            sound: "default",
            badge: 1,
          },
          notification_id: row.id,
        }),
      });
      if (res.ok) sent += 1;
      else {
        const text = await res.text();
        console.error("APNs error", res.status, text);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
    });
  }
});

async function buildApnsJwt(): Promise<string> {
  const keyId = Deno.env.get("APNS_KEY_ID")!;
  const teamId = Deno.env.get("APNS_TEAM_ID")!;
  const p8 = (Deno.env.get("APNS_P8") ?? "").replace(/\\n/g, "\n");

  const header = { alg: "ES256", kid: keyId };
  const claims = { iss: teamId, iat: Math.floor(Date.now() / 1000) };

  const enc = new TextEncoder();
  const b64 = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    return btoa(String.fromCharCode(...bytes))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };

  const unsigned = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(claims))}`;

  // Import PKCS8 P8 key
  const pem = p8
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsigned),
  );

  // Convert IEEE P1363 signature to raw 64-byte if needed — subtle returns P1363 for ECDSA.
  return `${unsigned}.${b64(new Uint8Array(sig))}`;
}

# Bioversee iOS

Native SwiftUI companion app (not a website wrapper). Same Supabase backend as the web app.

## Google sign-in → return to the app

Add **both** of these under Supabase → Authentication → URL Configuration → **Additional Redirect URLs**:

```text
com.bioversee.app://login-callback
https://bioversee.com/ios-auth
```

Deploy the web app so `/ios-auth` exists (bridge page). Flow:

1. App starts Google OAuth  
2. If the custom scheme is allowlisted, the auth sheet returns straight into the app  
3. Otherwise Safari finishes on `https://bioversee.com/ios-auth`, which immediately deep-links to `com.bioversee.app://login-callback…`

## Stay signed in / appearance

iOS stores sessions in the **Keychain** (no 7-day logout). UI accent color always syncs from the website’s `user_settings` (not editable in the app). Under **Account → App icon**, pick Green / Yellow / Red / Blue for the home-screen icon (local only; iOS shows a system confirmation when it changes).

## Multi-account (Gmail-style)

Account → **Add account** keeps every session in the Keychain. You can switch the active account for devices/controls; **Inbox** merges notifications from all signed-in accounts.

There is **no 7-day logout** on iOS — sessions stay until you log out that account.

## Push notifications

**Requires a paid Apple Developer Program team.** Free personal teams cannot use the Push Notifications capability / `aps-environment` entitlement — Xcode will fail signing if it’s enabled.

Until you enroll, the app uses **inbox polling (15s) + local banners**. That works on a personal team.

When enrolled:

1. Run `supabase/push_tokens.sql` in the Supabase SQL Editor (safe to leave if already run).
2. In Apple Developer → Keys → create an **APNs** key (`.p8`). Note Key ID + Team ID.
3. In `ios/Bioversee/Bioversee.entitlements` add:
   ```xml
   <key>aps-environment</key>
   <string>development</string>
   ```
   And in Xcode → Signing & Capabilities → **+ Capability → Push Notifications**.
   Uncomment `registerForRemoteNotifications()` in `PushNotificationManager`.
4. Deploy the edge function and set secrets:

```bash
supabase functions deploy push-notify --no-verify-jwt
supabase secrets set APNS_KEY_ID=... APNS_TEAM_ID=... APNS_BUNDLE_ID=com.bioversee.app APNS_PRODUCTION=false APNS_P8="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

5. Supabase Dashboard → Database → Webhooks → create webhook on `public.notifications` **INSERT** → HTTPS → your `push-notify` function URL.

Until the webhook is live, the app still polls every 5s and shows local banners for new unread items across all accounts. Run `supabase/notifications_realtime.sql` so web + iOS also get live inbox updates via Realtime.

## Open / run

```bash
cd ios
xcodegen generate   # if you changed project.yml
open Bioversee.xcodeproj
```

Signing & Capabilities → your Team → run on iPhone.

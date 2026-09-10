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

## Stay signed in

iOS stores the session in the **Keychain** and refreshes tokens automatically. There is **no 7-day logout** like the web multi-account vault.

## Open / run

```bash
cd ios
open Bioversee.xcodeproj
```

Signing & Capabilities → your Team → run on iPhone.

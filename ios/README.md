# Bioversee iOS

Native SwiftUI companion app for Bioversee — same idea as the GitHub app for github.com.

It is **not** a website wrapper. Screens, navigation, and controls are native. It talks to the same Supabase backend as the web app.

| Area | In the app |
|---|---|
| Auth | Email/password + **Google** |
| Devices | List, create, open |
| Controls | Switches & sliders (no charts) |
| Inbox | Notifications / invites |

## Open in Xcode

```bash
cd ios
open Bioversee.xcodeproj
```

Regenerate after `project.yml` changes: `xcodegen generate`

## Run on iPhone

1. Unlock the phone and trust this Mac.
2. Target **Bioversee** → **Signing & Capabilities** → pick your **Team**.
3. Choose your iPhone as the run destination → **Run**.
4. Trust the developer certificate on device if prompted.

## Google sign-in

Google uses the system auth sheet (standard for native apps), then returns into Bioversee. Add this redirect URL in Supabase → Authentication → URL Configuration → **Additional Redirect URLs**:

```text
com.bioversee.app://login-callback
```

Google provider must already be enabled (same as web).

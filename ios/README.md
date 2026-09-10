# Bioversee iOS

SwiftUI companion app: **login**, **device selection**, **controls**, and **notifications**. No process visualization (that stays on the web app).

## Open in Xcode

```bash
cd ios
open Bioversee.xcodeproj
```

If you change `project.yml` later, regenerate with:

```bash
xcodegen generate
```

## Run on your iPhone

Your Mac already sees **IPHONE 17 Pro** when it’s plugged in.

1. Unlock the iPhone and trust this Mac if prompted.
2. Open `ios/Bioversee.xcodeproj` in Xcode.
3. Select target **Bioversee** → **Signing & Capabilities**:
   - set **Team** to your Apple ID / developer team
   - keep **Automatically manage signing** on
4. In the run destination menu (toolbar), pick **IPHONE 17 Pro** (not a simulator).
5. Press **Run** (▶).
6. If iOS blocks the app: **Settings → General → VPN & Device Management** → trust your developer certificate, then open Bioversee again.

## What’s in the app

| Tab | Features |
|---|---|
| Devices | List devices, create device, open controls |
| Inbox | Notifications + accept / decline invites |
| Account | Email + log out |

Uses the same Supabase backend as `client-react-ts` (see `Bioversee/App/AppConfig.swift`).

**Auth:** email / password only on iOS. Google sign-in stays on the web.

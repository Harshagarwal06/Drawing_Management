# DrawVault iOS (Capacitor)

The iOS app is a Capacitor shell around the built web frontend in `../dist`.
It talks to the same Railway backend as the web app — there is no separate iOS codebase.

## Day-to-day workflow

```bash
# From dms-frontend/ — rebuild web assets and copy them into the iOS project
npm run ios:sync

# Open the Xcode workspace (always the .xcworkspace, never the .xcodeproj)
npm run ios:open
```

Then press ▶ in Xcode with an iPhone simulator selected.

## API URL

The native bundle bakes in `VITE_API_URL` at build time (`.env.production`):

- **Against production:** set `VITE_API_URL=https://<your-app>.up.railway.app` in `.env.production`, then `npm run ios:sync`.
- **Against a local backend:** the iOS Simulator shares the Mac's localhost, so
  `VITE_API_URL=http://localhost:3000 npx vite build && npx cap sync ios` works too.

The backend must allow the `capacitor://localhost` origin (handled in `dms-backend/server.js`).

## Requirements

- Xcode 15+ (Capacitor 6; Capacitor 7 needs Xcode 16)
- CocoaPods (`brew install cocoapods`)
- An iOS simulator runtime (Xcode → Settings → Platforms, or `xcodebuild -downloadPlatform iOS`)

## Shipping to TestFlight / the App Store

Requires an Apple Developer Program membership ($99/yr).

1. In Xcode: target **App** → Signing & Capabilities → select your Team
   (bundle id `com.uniqueproperties.drawvault` must be registered to your account).
2. `npm run ios:sync` to embed the latest web build (pointing at production).
3. Xcode: Product → Destination → **Any iOS Device (arm64)** → Product → **Archive**.
4. In the Organizer window: **Distribute App** → App Store Connect → Upload.
5. In App Store Connect: create the app record, attach the build to TestFlight
   (internal testers can install immediately), then submit for App Store review
   when ready. Review needs a demo login — use a dedicated Project Team account,
   not the director credentials.

Bump `CFBundleShortVersionString` / build number in Xcode for each upload.

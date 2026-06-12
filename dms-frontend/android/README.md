# DrawVault Android (Capacitor)

The Android app is a Capacitor shell around the built web frontend in `../dist` —
the exact same setup as the iOS app in `../ios`. It talks to the same Railway
backend as the web app; there is no separate Android codebase.

## Day-to-day workflow

```bash
# From dms-frontend/ — rebuild web assets and copy them into the Android project
npm run android:sync

# Open the project in Android Studio
npm run android:open
```

Then press ▶ in Android Studio with an emulator or USB device selected.

Without Android Studio, a debug APK can be built and installed from the CLI:

```bash
cd android && ./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

## API URL

The native bundle bakes in `VITE_API_URL` at build time (`.env.production`):

- **Against production:** set `VITE_API_URL=https://<your-app>.up.railway.app` in
  `.env.production`, then `npm run android:sync`.
- **Against a local backend:** the Android emulator reaches the host Mac at
  `10.0.2.2` (not `localhost`), so use
  `VITE_API_URL=http://10.0.2.2:3000 npx vite build && npx cap sync android`.
  A physical device needs the Mac's LAN IP instead. Cleartext http is allowed
  by `android:usesCleartextTraffic="true"` in the manifest (the Android
  equivalent of the iOS ATS exception).

The backend must allow the `https://localhost` origin — the Android WebView's
origin under Capacitor — which is handled in `dms-backend/server.js`.

## Requirements

- JDK 17–21 (the Gradle wrapper is pinned to 8.7 / AGP 8.5.2, which both support)
- Android SDK 34 — installed automatically by Android Studio, or via
  `brew install --cask android-commandlinetools` then
  `sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"`
- `android/local.properties` pointing `sdk.dir` at the SDK
  (`~/Library/Android/sdk`) — created automatically by Android Studio

## Shipping to the Play Store

Requires a Google Play developer account ($25 one-time).

1. Create a release keystore (once, keep it safe — losing it means losing the
   ability to update the app):
   `keytool -genkey -v -keystore drawvault.keystore -alias drawvault -keyalg RSA -keysize 2048 -validity 10000`
2. `npm run android:sync` to embed the latest web build (pointing at production).
3. Android Studio: Build → Generate Signed App Bundle → select the keystore →
   build a release `.aab`.
4. In the Play Console: create the app record, upload the bundle to internal
   testing, then promote to production. Review needs a demo login — use a
   dedicated Project Team account, not the director credentials.

Bump `versionCode` / `versionName` in `android/app/build.gradle` for each upload.

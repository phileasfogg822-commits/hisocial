# HiSocial APK client (Phase 27)

## What it is

The APK is a thin WebView shell around the same
backend the PWA uses — not a second app. Compose,
scheduling, analytics, monetization, reports, and
everything else run in the web app; the shell only
provides the native frame (JavaScript + DOM
storage, file picking for media uploads, back
navigation, external links handed to the browser).

Source lives in `android/`:
- `settings.gradle`, `build.gradle` (root),
  `app/build.gradle` (applicationId
  `com.hisocial.app`, version 1.0.0).
- `app/src/main/AndroidManifest.xml`
  (INTERNET permission, launcher activity).
- `app/src/main/java/com/hisocial/app/
  MainActivity.kt` (the WebView).
- `gradle/wrapper/gradle-wrapper.properties`
  (Gradle 8.2; Android Studio fetches it on
  import).

## Building

1. Open `android/` in Android Studio (it imports
   the Gradle project and downloads the SDK pieces
   it needs).
2. Set the backend URL in `app/build.gradle`:
   `HISOCIAL_BASE_URL`. Dev on an emulator:
   `http://10.0.2.2:4000`. Final VPS migration:
   the tunnel domain (e.g.
   `https://hisocial.example.com`). This is an
   owner step at migration time — the default is
   the emulator address, not a production URL.
3. Replace the placeholder launcher icon
   (`@android:drawable/sym_def_app_icon` in the
   manifest) with branded icons before any release.
4. Build → Generate Signed Bundle / APK (debug
   APKs install without a signing key; release
   needs the owner's keystore, which is never
   committed here).

## Backend handshake

`GET /api/client/info` (unauthenticated, no user
data) returns the backend identity and
capabilities: app name, backend version (from
`backend/package.json`), minimum client version,
and the feature list. The shell does not check it
yet — it exists so a future shell version can show
a compatibility notice instead of failing against
an old backend.

## What is NOT claimed

- **No built APK is delivered by this phase.**
  CI has no Android SDK (Docker + tests only),
  so no APK is compiled or verified here. The
  project source is the deliverable; the first
  real APK comes from an Android Studio build,
  which is an owner step.
- No native features: no push, no camera capture
  beyond file picking, no biometric login, no
  offline queue beyond the PWA drafts (Phase 26).
- No Play Store listing, no signing key, no
  production URL baked in.

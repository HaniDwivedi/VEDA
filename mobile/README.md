# Android mobile client

The mobile client is wrapped with Capacitor. To build a locally installable
debug APK on Windows:

1. Install Android SDK Platform 35, Build Tools 35, and Platform Tools.
2. Set `ANDROID_HOME` and `ANDROID_SDK_ROOT` to the SDK directory and use
   JDK 21.
3. From the project root, run `npm install` and `npm run android:debug`.
4. Install `android/app/build/outputs/apk/debug/app-debug.apk` with
   `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.
5. On first launch, enter the deployed backend's HTTPS origin in **Backend
   URL**, save it, and pair by scanning the desktop's one-time QR code.

The QR scanner uses the native Android barcode scanner when Google Play
Services provides it and falls back to the in-app camera scanner otherwise.
Screen viewing and chat need a reachable deployed backend; screen sharing is
started only from the desktop browser.

`android:debug` creates a debug-signed APK for device testing. It is not a
Play Store release. A production release must be built and signed with the
organization's persistent private signing key, then tested on supported
physical Android devices.

## Automatic live updates

The mobile app uses Capgo for over-the-air updates of its web bundle (HTML, CSS,
JavaScript, and assets). After a compatible release is installed, updates are
downloaded automatically and applied when the app moves to the background.
Changes to Android/native code, Capacitor plugins, or native configuration still
require a newly signed Android release through the store.

### One-time setup

1. [Create a Capgo account](https://capgo.app/) and add an app with the ID
   `com.veda.controller`. This must match `appId` in the root
   `capacitor.config.json`.
2. Create a Capgo API key and add it to this GitHub repository as an Actions
   secret named `CAPGO_TOKEN` (Settings > Secrets and variables > Actions).
   Do not commit the key or put it in the mobile app.
3. Run `npm run android:sync`, then build, sign, and publish a new Android app
   release containing the updater plugin. Existing installations without this
   plugin cannot receive OTA updates; after this first store update, compatible
   web-bundle changes can arrive automatically.
4. On subsequent pushes to `main` that change `mobile/`, `shared/`, or the root
   dependency manifests, GitHub Actions builds the mobile bundle and uploads it
   to Capgo's `production` channel when `CAPGO_TOKEN` is configured. Without
   that secret, the build still passes but the workflow warns and skips upload.
   The workflow can also be started manually from the Actions tab.

Each upload receives a new patch bundle version. OTA updates must remain
compatible with the native app already installed; native-code and plugin
changes must be released through the app store instead.

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

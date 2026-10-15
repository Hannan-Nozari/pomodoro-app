# Pomodoro Timer

A focus timer that runs as a web app and as an Android app from the same
source. Sessions, tasks, and history live in `localStorage` — nothing leaves the
device.

- 25 / 5 / 15 minute defaults, adjustable, with a long break every 4th session
- Task list and a rolling 50-entry session history
- End-of-session alert that fires even when the app is backgrounded or killed

## Development

```bash
npm ci
npm run dev
```

## Android

The Android project lives in `android/` (Capacitor). Building it needs JDK 21
and the Android SDK (platform 36, build-tools 35).

```bash
npm test
npm run android:release
```

Outputs:

| Artifact | Path |
| --- | --- |
| APK (sideload / direct download) | `release/pomodoro-1.0-v1.apk` |
| AAB (Play Store upload) | `release/pomodoro-1.0-v1.aab` |

### Signing

Release builds are signed with the keystore described in
`android/keystore.properties`. That file and the `.jks` are git-ignored and are
**not** reproducible. Back both up somewhere durable and private. With Play App
Signing, Google holds the app signing key and this local key can serve as the
upload key; a lost upload key can be reset through Play Console. A directly
distributed APK still needs its original signing key for updates.

Release builds fail if `keystore.properties` or its keystore is missing. Debug
builds use the normal Android debug key. Never commit signing credentials.

### Timing behaviour

The countdown is anchored to a wall-clock deadline rather than to interval
ticks, because Android freezes a backgrounded WebView's timers. The same
deadline is handed to `AlarmManager` (via `@capacitor/local-notifications`) so
the alert fires without the app running, and is persisted so a killed app
resumes — or settles a session that ended while it was closed — on next launch.

Bumping a release: raise `versionCode` and `versionName` in
`android/app/build.gradle`.

## Publishing to Google Play

The build is configured for Play's current requirements: `targetSdk` 36 (required
for new apps since 31 August 2026), a signed AAB, R8 + resource shrinking, and a
release build that is not debuggable.

Upload `release/pomodoro-1.0-v1.aab`. The listing
assets and copy live in [`store/`](store/).

### Exact alarms

The app declares `USE_EXACT_ALARM`. This is a restricted permission, and Play
limits it to apps whose core function is precisely-timed alerts — alarm, clock
and timer apps. The app’s core function is a user-started focus/break timer. Confirm the current
Play declaration against that function; approval is decided by Google. A
proposed justification for review is:

> Pomodoro Timer is a focus timer. The user chooses a session length and the app
> must alert them at exactly that moment, including while the app is in the
> background or has been closed by the system. A late alert means the user has
> overrun their focus session, which defeats the app's only function. No other
> feature uses the permission.

If Google pushes back, the fallback is a one-line change — swap
`USE_EXACT_ALARM` for `SCHEDULE_EXACT_ALARM` in
`android/app/src/main/AndroidManifest.xml`. The app keeps working either way:
`@capacitor/local-notifications` checks `canScheduleExactAlarms()` and falls back
to an inexact `setAndAllowWhileIdle` alarm, so the alert still fires, just with
Doze-window slack. The cost of that fallback is that alerts can land minutes
late for every user, which is why the exact permission is the default here.

### Data safety

Declare **no data collected and no data shared**. The app has no accounts, no
analytics and no network calls; sessions, tasks and history are kept in
`localStorage` on the device. `INTERNET` is present only because the WebView
requires it to load the bundled local assets.

### Before the first upload

- **The application ID is permanent.** The proposed replacement is
  `com.cloudzy.pomodoro`; Play Console confirmed it available on 15 October 2026,
  while the original `com.pomodoro.app` is already in use. User approval of the
  replacement is pending before app creation or upload. It cannot be
  changed after the first artifact upload — a different ID means a new listing with no
  installs or reviews. Change it in `android/app/build.gradle`,
  `android/app/src/main/res/values/strings.xml` and `capacitor.config.json`.
- A privacy policy URL is required by the listing even though nothing is
  collected.
- New personal developer accounts must run a closed test with 12 opted-in
  testers for 14 consecutive days before the production track unlocks.

### Alert limits

Notifications require the user’s permission. Silent mode keeps the notification
but uses a silent channel. Android 12–12L uses `SCHEDULE_EXACT_ALARM`; if exact
alarms are disabled in system settings the plugin uses an inexact fallback.
Android can defer idle-mode alerts, especially sessions less than nine minutes
apart. Force-stopping the app in Settings disables its alarms until it is opened
again. A normal background process kill is supported.

Cloud backup and device transfers of app storage are explicitly excluded, so
tasks and timer history stay on the device.

### Internal testing

Use the **Internal testing** track only for the prepared release. Confirm the
permanent package, existing app/track versions, and signing certificate in Play
Console before the first upload. A successful local build is not evidence of a
Play upload or rollout. The Console account must have app creation/upload rights.
Do not create API credentials or accept Play App Signing terms without approval.

Official requirements: [target API](https://developer.android.com/google/play/requirements/target-sdk),
[internal tests](https://support.google.com/googleplay/android-developer/answer/9845334),
and [app signing](https://developer.android.com/studio/publish/app-signing).

`npm run android:release` builds from a private temporary copy to exclude macOS
folder icons from Android resources, then saves the signed artifacts and R8 map
in `release/`. On this Mac it detects the installed Homebrew JDK 21; elsewhere
set `JAVA_HOME` to your JDK 21 installation.

To run the Android lifecycle test on an emulator/device:

```bash
cd android
./gradlew connectedReleaseAndroidTest -PtestRelease
```

# Pomodoro Timer

A focus timer that runs as a web app and as an Android app from the same
source. Sessions, tasks, and history live in `localStorage` — nothing leaves the
device.

- 25 / 5 / 15 minute defaults, adjustable, with a long break every 4th session
- A live countdown in the notification shade while a session runs
- A real alarm at the end: the screen wakes, a full-screen alert appears over
  the lock screen, and the sound plays twice through the alarm stream
- Four alarm sounds, each previewable from settings
- Task list, and a rolling 50-entry session history you can annotate
- End-of-session alert that fires even when the app is backgrounded or killed

## Development

```bash
npm install
npm run dev
```

## Android

The Android project lives in `android/` (Capacitor). Building it needs JDK 21
and the Android SDK (platform 37, build-tools 37).

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease
```

Outputs:

| Artifact | Path |
| --- | --- |
| APK (sideload / direct download) | `android/app/build/outputs/apk/release/app-release.apk` |
| AAB (Play Store upload) | `android/app/build/outputs/bundle/release/app-release.aab` — `./gradlew bundleRelease` |

### Signing

Release builds are signed with the keystore described in
`android/keystore.properties`. That file and the `.jks` are git-ignored and are
**not** reproducible — losing them means never being able to update the app on
the Play Store under the same listing. Back both up somewhere durable.

Without `keystore.properties` present the release build still succeeds, but the
output is unsigned.

### Timing behaviour

The countdown is anchored to a wall-clock deadline rather than to interval
ticks, because Android freezes a backgrounded WebView's timers. The same
deadline is handed to `AlarmManager` (via `@capacitor/local-notifications`) so
the alert fires without the app running, and is persisted so a killed app
resumes — or settles a session that ended while it was closed — on next launch.

### The running-timer notification

`OngoingTimerPlugin` posts the countdown as a notification whose timer is drawn
by Android's own chronometer, given the session's end time. Nothing in
JavaScript ticks it, which is the point: the WebView is frozen while the app is
backgrounded, which is exactly when the shade is what the user can see. A
companion `TimerDoneReceiver` is scheduled for the deadline to clear it, since
a chronometer left alone would sail on into negative time.

### The end-of-session alarm

A notification is not an alarm: it plays once, on the notification stream at
notification volume, and never wakes the screen — so a finished session was
easy to miss entirely. The alert is therefore native:

- `AlarmPlugin` schedules it with `AlarmManager.setAlarmClock()`, which is
  exempt from Doze deferral and registers in the system's next-alarm indicator
- `AlarmService` plays the chosen sound through `USAGE_ALARM`, so it follows the
  alarm volume and is heard over a lowered ringer, and vibrates
- the notification carries a full-screen intent, which turns the display on and
  shows `AlarmActivity` over the lock screen
- it rings twice and falls silent; the alarm screen stays up until dismissed

`USE_FULL_SCREEN_INTENT` is declared for that alert, and the ringing service is
a `shortService` foreground service, which needs no further justification
because it runs for seconds.

### Alarm sounds

`src/lib/alarm-presets.json` is the single source of truth. The app synthesises
those tones with the Web Audio API for previews and the in-app chime, and
`scripts/make-alarm-sounds.py` renders the identical tones to WAVs in
`res/raw` for the notification channels — so what you preview is what the alert
plays. Re-run the script after editing the presets:

```bash
python3 scripts/make-alarm-sounds.py
```

A notification channel's sound is fixed once created, so each sound has its own
channel, created on demand. Those WAVs are referenced only by name at runtime,
so `res/raw/keep.xml` holds them against resource shrinking.

Bumping a release: raise `versionCode` and `versionName` in
`android/app/build.gradle`.

## Publishing to Google Play

The build targets `targetSdk` 36, which is what Play requires of new apps as of
31 August 2026. `compileSdk` is 37, so the app is built against the newest SDK.
Targeting 37 is a one-line change in `android/variables.gradle`, held back only
because the Android 17 emulator image crashes on launch (a null dereference in
the emulator's own address-space device), so that target cannot be verified at
runtime here — do it once you can run it on an Android 17 device.

It ships as a signed AAB with R8 and resource shrinking, and the release build
is not debuggable. `minSdk` is 24 (Android 7.0), Capacitor 8's baseline.

Upload `android/app/build/outputs/bundle/release/app-release.aab`. The listing
assets and copy live in [`store/`](store/).

### Exact alarms

The app declares `USE_EXACT_ALARM`. This is a restricted permission, and Play
limits it to apps whose core function is precisely-timed alerts — alarm, clock
and timer apps. A focus timer qualifies: the user sets a session length and the
whole point is that the alert lands at that moment, not some minutes later. The
Console will ask for a justification; this is the one to give:

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

- **The application ID is permanent.** It is currently `com.pomodoro.app`
  (a Capacitor scaffold default, verified unclaimed on Play). It cannot be
  changed after the first publish — a different ID means a new listing with no
  installs or reviews. Change it in `android/app/build.gradle`,
  `android/app/src/main/res/values/strings.xml` and `capacitor.config.json`.
- A privacy policy URL is required by the listing even though nothing is
  collected.
- New personal developer accounts must run a closed test with 12 opted-in
  testers for 14 consecutive days before the production track unlocks.

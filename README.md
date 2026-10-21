# Pomodoro Timer

A focus timer that runs as a web app and as an Android app from the same
source. Sessions, tasks, and history live in `localStorage` — nothing leaves the
device.

- 25 / 5 / 15 minute defaults, adjustable, with a long break every 4th session
- A live countdown in the notification shade while a session runs
- A choice of how a session ends: ring like an alarm (screen wakes, heard on
  silent), a plain notification that follows silent mode, or vibrate only — and
  with headphones in, the sound plays in your headphones
- Four alarm sounds, each previewable from settings
- Task list: pick what you are focusing on, and each session is logged against it
- A weekly summary — hours focused, day-by-day bars, your peak hour, streak,
  and time per task — all derived from the history already on the device
- Optional Do Not Disturb for the length of a focus session, lifted automatically
  on a pause, a break, or the end of the session (alarms still ring through it)
- A home-screen widget and a Quick Settings tile that count the session down and
  start one with a tap
- A rolling session history you can annotate
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

The notification shows the session counting down, the task it is counting
towards, a progress bar, and Pause / Resume / Reset. It is built in
`TimerNotification` from `TimerState`, not from anything the page passes at the
time, because almost everything that redraws it happens while the WebView is
frozen.

Three different clocks make it work, each for the part it can actually do:

- the countdown is Android's own chronometer, given the end time — it ticks
  every second for free, with nothing of ours running
- the progress bar is redrawn by a one-minute `RTC` (non-wakeup) alarm, aligned
  to the minute of the countdown rather than a minute from now; it never wakes
  a sleeping phone to move a bar nobody can see
- `TimerDoneReceiver` clears the whole thing at the deadline, since a
  chronometer left alone would sail on into negative time
- `BootReceiver` rebuilds the alarm and the notification after a reboot or an
  app update, both of which wipe every alarm the app had scheduled

Pause and Resume take effect in `TimerActionReceiver` immediately — cancelling
and re-arming the alarm themselves — because the shade is precisely where the
app is not running. The web layer still owns the timer: what happened is left
in `TimerState` as a pending action, and it reconciles on launch, on return to
the foreground, and the moment the native side says a button was pressed.
That last signal is needed because pulling the shade down over the app does not
hide the page, so there is no visibility change to react to.

### The end-of-session alert

The user picks how a finished session announces itself, and `AlarmService`
plays all three, because a notification channel can't do any of them well — it
plays once, at notification volume, can't choose its output, and a channel's
sound is fixed for good once created.

| Style | Sound | Screen | Scheduled with |
| --- | --- | --- | --- |
| Ring like an alarm | alarm volume, heard on silent, plays twice | full-screen alert over the lock screen | `setAlarmClock()` — Doze-exempt, in the next-alarm indicator |
| Notification | notification volume, follows the ringer: silent is silent, vibrate only buzzes | heads-up notification | exact `setExactAndAllowWhileIdle()` |
| Vibrate only | none | heads-up notification | same |

Only the alarm style registers as an alarm clock: that is what puts the clock
icon in the status bar, which someone who chose a quiet ending didn't ask for.
The quiet styles leave their notification in the shade like any message; the
alarm's clears when it is dismissed.

**Headphones.** On many phones — Samsung's among them — the alarm stream plays
on the phone's speaker even with Bluetooth headphones connected, so someone
wearing earbuds heard nothing. When a headset is connected (Bluetooth, BLE
audio, wired, USB, hearing aid) the sound is played on the media route instead,
which is where the headphones are, with the device set as preferred output. Every
style also takes transient audio focus, so music in the headphones pauses for
the alert and resumes after.

`USE_FULL_SCREEN_INTENT` is declared for the alarm style's alert, and the
service is a `shortService` foreground service, which needs no further
justification because it runs for seconds.

### Do Not Disturb

`FocusModePlugin` switches Android's own interruption filter rather than
reimplementing quiet hours, and uses `INTERRUPTION_FILTER_PRIORITY`, not `NONE`,
so the end-of-session alarm is still heard. Notification-policy access is
granted by the user on a system screen and can be revoked at any time, so every
call degrades to a no-op when it is missing.

Lifting the filter is native, in `FocusMode`, because the moment it has to be
lifted is one the web layer is often not alive for: the session ends on an
alarm, and the shade's own Pause and Reset take effect with nothing of the app
running. Leaving that to JavaScript left the phone silenced until the app was
next opened. The app only ever undoes its own silencing — a flag records
whether this app is what turned the filter on, so a Do Not Disturb the user set
for themselves is left alone.

### The widget and the Quick Settings tile

Both are drawn by the system while the app is asleep and cannot read its
`localStorage`, so `TimerState` mirrors the three fields they need — running,
deadline, label — into `SharedPreferences` whenever the ongoing notification is
updated. The widget's countdown is a `Chronometer` driven from the deadline, the
same trick as the notification, so it keeps time without anything running.

Neither can run the timer itself. Tapping an idle widget or tile parks a request
in that same store and opens the app, which picks it up on launch and on every
return to the foreground; tapping a running one only opens the app, so a stray
tap cannot cancel a session.

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

# Android internal testing release readiness

Updated 15 October 2026. **The Play app entry is created; no artifact has been uploaded.**

## Build identity

- Application ID: `com.cloudzy.pomodoro` (availability verified, explicitly approved by the user, and Play app entry created). The original `com.pomodoro.app` is already in use and cannot be registered for this app.
- Version name: `1.0`; version code: `1`
- Minimum SDK: 23; compile/target SDK: 36
- Existing local signing key reused; no credentials generated or committed
- Signing certificate SHA-256: `5b241bdc3c8b56ddcde4203aca552bc514682367b6ac985da583f4045d309b43`
- AAB: `release/pomodoro-1.0-v1.aab` (about 2.5 MiB)
- APK: `release/pomodoro-1.0-v1.apk` (about 2.0 MiB)
- R8 mapping: `release/mapping.txt`

## Verification

- `npm test`: 12 passing regression tests covering exact deadline restoration, early completion, suspended/killed session settlement, stale pause, long breaks, sound changes, and native schedule/cancel ordering.
- `npm run android:release`: signed AAB/APK and full release lint completed successfully. The build stages source in a private temporary directory to exclude macOS custom-folder metadata.
- `connectedReleaseAndroidTest -PtestRelease` on Android 16/API 36: 1 meaningful release instrumentation test passed for `com.cloudzy.pomodoro` (64.112 seconds), covering native bridge scheduling, cancellation on pause, silent-channel replacement, a real background notification, and one correctly dated history entry after resume. UI probes and Activity cleanup avoid unbounded WebView idle waits; the test has a 120-second timeout.
- Final APK DEX, manifest, resources and bundled assets match the tested APK payload (402 compared entries; see the generated comparison JSON for the exact count).
- Official bundletool 1.18.3 validation passed.
- AAB JAR signature and APK v1/v2 signatures verify, with the same existing certificate.
- The AAB contains the bundled notification WAV and no native `.so` libraries.
- Runtime dependency audit: zero advisories. Full development audit: 7 advisories remain in the Tailwind 3 build-time dependency graph (5 high, 2 moderate). These dependencies are not bundled into the installed app.
- App release lint has no errors; remaining warnings concern scaffold resources and available tool updates. Capacitor's upstream lint baseline is retained.

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| AAB | `bee80c258ff8bc93fb582cf806d16f8615984ddba1c7e2cf9c390a1eb5bf7aa4` |
| APK | `2035ef083d99b10a5dfdbde34c2888d99aba4f0f440d5c95198f88a7d1fc294a` |

Build, lint, test, dependency-audit, signing and metadata evidence is in the local, git-ignored `release/` directory.

## Play handoff

Developer account access is now verified against the user-supplied organization ID. With explicit action-time user approval, the invitation and its Developer Distribution Agreement confirmation were accepted on 15 October 2026. The existing membership includes draft app creation, testing releases, tester management, and Play App Signing. No permissions were edited. Detailed membership evidence stays in the local, git-ignored `release/` directory.

Play Console rejected the original package `com.pomodoro.app` as already in use and confirmed **Package name available** for `com.cloudzy.pomodoro`. The user explicitly approved that permanent replacement and the app-creation signing/policy/export declarations. The **Pomodoro Timer**, English (United States), App, Free entry was then created successfully. Original-package artifacts remain archived locally in `release/original-com.pomodoro.app/`.

1. Resume the existing app's Internal testing track. Chrome currently reports that another extension UI is open and blocks browser actions; the user must dismiss that popup before automation continues. The initial tester-list dialog is open, but its contents/save have not been confirmed.
2. The [Play App Signing Terms](https://play.google/play-app-signing-terms/), Developer Program Policies, and US export-compliance confirmations were submitted with explicit user approval during app creation. Approval includes Google generating/holding the app signing key; the private key cannot be exported. Inspect the resulting signing configuration and register/verify the existing local upload certificate before the first upload. Do not ask for the same package or agreement approval again.
3. Prepare and roll out an **Internal testing** release only. No service-account/API credentials have been created. Do not accept further materially different agreements, create security-sensitive API access, or incur fees without approval.
4. Configure the user as the initial tester and obtain the actual opt-in link. Follow processing/review status until the track's outcome is visible. Do not equate a successful upload with publication.

The app entry and approved app-creation declarations are submitted. No tester list save, artifact upload, release rollout, store listing, audience/data-safety declaration, or production release is confirmed. Intended audience and a hosted privacy-policy URL have not been confirmed; internal testing may be started before full listing setup according to Google's guidance.

## Limits

Runtime testing was on an Android 16 emulator, not a physical device or every supported Android version. Android 12–12L exact-alarm settings, reboot behavior, Doze restrictions and private-space behavior have not been separately exercised. Notification permission and device settings affect delivery. Force-stop in Android Settings cancels alarms until the app is reopened.

## Official references

- [Play target SDK requirements](https://developer.android.com/google/play/requirements/target-sdk): new phone apps target API 36 from 31 August 2026.
- [Internal testing setup](https://support.google.com/googleplay/android-developer/answer/9845334): up to 100 testers, setup can be incomplete, package fixed after artifact upload.
- [Android app signing](https://developer.android.com/studio/publish/app-signing).
- [Android backup controls](https://developer.android.com/identity/data/autobackup).
- [Capacitor notifications](https://capacitorjs.com/docs/apis/local-notifications).

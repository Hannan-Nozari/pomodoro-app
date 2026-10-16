# Android internal testing release readiness

Updated 16 October 2026. **The internal testing track is Active and release `Release1`, version `1.0` / code `2`, is Available to internal testers.** The user uploaded and released the replacement bundle. The single-user tester list was then created, selected, and saved successfully. The opt-in page recognizes the intended Google account and shows its invitation.

## Build identity

- Application ID: `com.cloudzy.pomodoro` (availability verified, explicitly approved by the user, and Play app entry created). The original `com.pomodoro.app` is already in use and cannot be registered for this app.
- Version name: `1.0`; version code: `2`
- Minimum SDK: 24 (Android 7.0); compile/target SDK: 36
- Existing local signing key reused; no credentials generated or committed
- Signing certificate SHA-256: `5b241bdc3c8b56ddcde4203aca552bc514682367b6ac985da583f4045d309b43`
- AAB: `release/pomodoro-1.0-v2.aab` (2,574,146 bytes)
- APK: `release/pomodoro-1.0-v2.apk` (1,983,858 bytes)
- R8 mapping: `release/pomodoro-1.0-v2-mapping.txt` (also `release/mapping.txt`)

The minimum SDK was raised from 23 to 24 to satisfy Play automatic protection while keeping protection enabled. Android 6 devices are no longer supported. Version code 2 avoids reusing the number from the rejected upload. Package identity, upload signing key, version name, and app behavior are unchanged. The original version-code-1 artifacts remain available locally for reference; upload the version-code-2 AAB.

## Verification

- `npm run android:release`: version-code-2 signed AAB/APK and full release lint completed successfully on 16 October (Gradle `BUILD SUCCESSFUL in 59s`). The build stages source in a private temporary directory to exclude macOS custom-folder metadata.
- Official bundletool 1.18.3 validation passed for the replacement. Dumping its packaged manifest confirms `com.cloudzy.pomodoro`, version `1.0`, code `2`, minimum SDK `24`, and target SDK `36`.
- Version-code-2 AAB JAR signature and APK v1/v2 signatures verify. The AAB certificate matches the original version-code-1 AAB, and the APK has the existing upload certificate above.
- Earlier app-code validation: `npm test` passed 12 regression tests covering exact deadline restoration, early completion, suspended/killed session settlement, stale pause, long breaks, sound changes, and native schedule/cancel ordering.
- Earlier version-code-1 `connectedReleaseAndroidTest -PtestRelease` on Android 16/API 36: 1 meaningful release instrumentation test passed for `com.cloudzy.pomodoro` (64.112 seconds), covering native bridge scheduling, cancellation on pause, silent-channel replacement, a real background notification, and one correctly dated history entry after resume. Its final APK payload matched the tested payload (402 entries). These runtime tests were not repeated for the SDK/version-only replacement; they do not attest that version-code-2 bytes were exercised on a device.
- The AAB contains the bundled notification WAV and no native `.so` libraries.
- Runtime dependency audit: zero advisories. Full development audit: 7 advisories remain in the Tailwind 3 build-time dependency graph (5 high, 2 moderate). These dependencies are not bundled into the installed app.
- App release lint has no errors; remaining warnings concern scaffold resources and available tool updates. Capacitor's upstream lint baseline is retained.

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| AAB | `6c87b9a662758ece8cf6fe938884bcc9ccc19b4c0f4d3d97f2759ee2bbc52d49` |
| APK | `1c7277bf67215946a3b88bfa941fe74c29ca262b64888aaee6ff507427029e06` |

Build, lint, test, dependency-audit, signing and metadata evidence is in the local, git-ignored `release/` directory. Replacement evidence is recorded in `min-sdk-24-validation.json`, `min-sdk-24-build.log`, and the other `min-sdk-24-*.log` files.

## Verified Google Play outcome

Developer account access is now verified against the user-supplied organization ID. With explicit action-time user approval, the invitation and its Developer Distribution Agreement confirmation were accepted on 15 October 2026. The existing membership includes draft app creation, testing releases, tester management, and Play App Signing. No permissions were edited. Detailed membership evidence stays in the local, git-ignored `release/` directory.

Play Console rejected the original package `com.pomodoro.app` as already in use and confirmed **Package name available** for `com.cloudzy.pomodoro`. The user explicitly approved that permanent replacement and the app-creation signing/policy/export declarations. The **Pomodoro Timer**, English (United States), App, Free entry was then created successfully. Original-package artifacts remain archived locally in `release/original-com.pomodoro.app/`.

1. The user requested the file for manual upload after repeated Mac/browser disconnects. The first upload was rejected for minimum SDK 23. The replacement was manually uploaded and released: the live release details confirm app bundle `2 (1.0)`, API levels `24+`, target SDK `36`, status **Available to internal testers**, and release time displayed as **Oct 16 2:34 PM**.
2. The track is **Active**. `Pomodoro internal testers` contains one verified account and is selected for this app's internal track; its selection persisted after navigating away and back. Google stores lists for account-wide reuse, but no other app was selected or changed. The user explicitly requested completion of tester setup after receiving the list-creation steps. Only the intended account was added.
3. The [testing invitation](https://play.google.com/apps/internaltest/4701148535155828346) was opened under the intended Google account and showed **You're invited to test com.cloudzy.pomodoro (unreviewed)** and **Accept invite**. Invitation acceptance and installation remain user actions on the Android device; no acceptance was submitted by automation. The invitation discloses sharing the tester's email and app-use information with the developer.
4. [Release details](https://play.google.com/console/u/0/developers/4686045226762172476/app/4975712220361619456/tracks/4701148535155828346/releases/1/details) and [tester configuration](https://play.google.com/console/u/0/developers/4686045226762172476/app/4975712220361619456/tracks/4701148535155828346?tab=testers) are verified. Evidence is saved locally as `release/play-internal-release-available.png`, `release/play-testers-active.png`, and `release/play-internal-release-status.json`.
5. The [Play App Signing Terms](https://play.google/play-app-signing-terms/), Developer Program Policies, and US export-compliance confirmations were submitted with explicit user approval during app creation. Approval includes Google generating/holding the app signing key; the private key cannot be exported. The release draft visibly confirmed that releases are signed by Google Play and automatic protection is enabled. No service-account/API credentials were created.

This is an **internal testing release only**. Google marks it **Not reviewed** and presents the temporary name `com.cloudzy.pomodoro (unreviewed)` until full app setup and review are complete. No production publication, store-listing completion, or audience/data-safety declaration was performed. Intended audience and a hosted privacy-policy URL have not been confirmed; these are separate work before a broader release.

## Limits

Runtime testing was on an Android 16 emulator, not a physical device or every supported Android version. Android 12–12L exact-alarm settings, reboot behavior, Doze restrictions and private-space behavior have not been separately exercised. Notification permission and device settings affect delivery. Force-stop in Android Settings cancels alarms until the app is reopened.

## Official references

- [Play target SDK requirements](https://developer.android.com/google/play/requirements/target-sdk): new phone apps target API 36 from 31 August 2026.
- [Internal testing setup](https://support.google.com/googleplay/android-developer/answer/9845334): up to 100 testers, setup can be incomplete, package fixed after artifact upload.
- [Android app signing](https://developer.android.com/studio/publish/app-signing).
- [Play automatic protection prerequisites](https://support.google.com/googleplay/android-developer/answer/10183279): minimum API 24 or higher.
- [Android backup controls](https://developer.android.com/identity/data/autobackup).
- [Capacitor notifications](https://capacitorjs.com/docs/apis/local-notifications).

# Android internal testing release readiness

Prepared 14 October 2026. **No artifact has been uploaded to Google Play.**

## Build identity

- Application ID: `com.pomodoro.app` (confirmed by the user before first upload)
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
- `connectedReleaseAndroidTest -PtestRelease` on Android 16/API 36: 1 meaningful release instrumentation test passed, covering native bridge scheduling, cancellation on pause, silent-channel replacement, a real background notification, and one correctly dated history entry after resume.
- Final APK DEX, manifest, resources and bundled assets match the tested APK payload (402 compared entries; see the generated comparison JSON for the exact count).
- Official bundletool 1.18.3 validation passed.
- AAB JAR signature and APK v1/v2 signatures verify, with the same existing certificate.
- The AAB contains the bundled notification WAV and no native `.so` libraries.
- Runtime dependency audit: zero advisories. Full development audit: 7 advisories remain in the Tailwind 3 build-time dependency graph (5 high, 2 moderate). These dependencies are not bundled into the installed app.
- App release lint has no errors; remaining warnings concern scaffold resources and available tool updates. Capacitor's upstream lint baseline is retained.

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| AAB | `f335c3c50cf1de24481dcba87a2453059c3db9333cc066239dc6a7937dc3ed57` |
| APK | `00ff1bd4c2f560957066fe293feb4290304ad046c41623e10f22ff32e52c09de` |

Build, lint, test, dependency-audit, signing and metadata evidence is in the local, git-ignored `release/` directory.

## Play handoff

The user approved the permanent package `com.pomodoro.app` and the disclosed [Play Console terms](https://play.google/console/terms-of-service/). Those terms were accepted under `hannan.nozari@gmail.com`. Reopening the exact requested Cloudzy organization link afterward still redirects that Gmail session to developer-account signup, so existing Cloudzy access is not verified.

Google sign-in reported that it could not find the supplied office account. Google account notices identified the user's company email as another candidate. That sign-in reached Google's identity-verification challenge, and the offered alternative ended with 'Couldn't sign you in'. Manual sign-in using the Google account that already has Cloudzy developer access is required. No credentials were entered or recovered by the agent.

1. Sign in to the existing developer account with app creation/upload authority at [Play Console](https://play.google.com/console). Do not send passwords in chat.
2. Use the confirmed permanent package `com.pomodoro.app`. Do not rename it or ask for the same package approval again. Once an artifact is uploaded, its package is fixed.
3. Inspect the existing app, upload certificate, used version codes, and Play App Signing enrollment before uploading. Version code 1 is provisional until Console confirms it is unused for this app.
4. Prepare and roll out an **Internal testing** release only. Stop for user approval if a new signing agreement, security-sensitive API access, or a fee is required. No service-account/API credentials have been created.
5. Confirm the configured tester access and obtain the actual opt-in link. Follow processing/review status until the track's outcome is visible. Do not equate a successful upload with publication.

No Play app/listing, tester list, content/audience/data-safety declaration, Play App Signing agreement or public production release was created or submitted. Only the specifically approved Play Console terms were accepted. Intended audience and a hosted privacy-policy URL have not been confirmed; internal testing may be started before full listing setup according to Google's guidance.

## Limits

Runtime testing was on an Android 16 emulator, not a physical device or every supported Android version. Android 12–12L exact-alarm settings, reboot behavior, Doze restrictions and private-space behavior have not been separately exercised. Notification permission and device settings affect delivery. Force-stop in Android Settings cancels alarms until the app is reopened.

## Official references

- [Play target SDK requirements](https://developer.android.com/google/play/requirements/target-sdk): new phone apps target API 36 from 31 August 2026.
- [Internal testing setup](https://support.google.com/googleplay/android-developer/answer/9845334): up to 100 testers, setup can be incomplete, package fixed after artifact upload.
- [Android app signing](https://developer.android.com/studio/publish/app-signing).
- [Android backup controls](https://developer.android.com/identity/data/autobackup).
- [Capacitor notifications](https://capacitorjs.com/docs/apis/local-notifications).

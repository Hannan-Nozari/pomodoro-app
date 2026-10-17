import { Capacitor, registerPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { DEFAULT_ALARM, soundFileFor } from './sounds'

// Native alarm: AlarmManager.setAlarmClock plus a foreground service that rings
// through the alarm stream behind a full-screen intent. A scheduled
// notification cannot do this — it plays once at notification volume and never
// wakes the screen, so a finished session was easy to sleep through.
const NativeAlarm = registerPlugin('Alarm')

const isNative = Capacitor.isNativePlatform()

// Permission is requested lazily, on the first Start tap, rather than at launch:
// asking before the user has done anything reads as a shakedown and gets denied.
//
// Concurrent callers share one in-flight check so the user sees a single prompt;
// a grant is cached, but a refusal is not, so turning notifications back on in
// system settings is picked up on the next session instead of needing a restart.
let permissionPending = null
let permissionGranted = false

// Monotonic token for the live alarm request. Scheduling awaits the permission
// prompt, which the user can outlast by pausing or resetting; without this the
// late schedule would land after the cancel and alert for a dead session.
let alarmEpoch = 0

export function ensureAlarmPermission() {
  if (!isNative) return Promise.resolve(false)
  if (permissionGranted) return Promise.resolve(true)
  if (permissionPending) return permissionPending

  permissionPending = (async () => {
    try {
      let { display } = await LocalNotifications.checkPermissions()
      if (display === 'prompt' || display === 'prompt-with-rationale') {
        ;({ display } = await LocalNotifications.requestPermissions())
      }
      permissionGranted = display === 'granted'
      return permissionGranted
    } catch (err) {
      console.warn('Notification permission unavailable:', err)
      return false
    } finally {
      permissionPending = null
    }
  })()

  return permissionPending
}

// Keyed by SESSION_TYPES values. Spelled out rather than imported from the hook
// so this module stays free of a circular dependency.
const COPY = {
  work:       { title: 'Focus session complete', body: 'Nice work — time for a break.' },
  shortBreak: { title: 'Break over',             body: 'Ready for the next focus session?' },
  longBreak:  { title: 'Long break over',        body: 'Ready for the next focus session?' },
}

/**
 * Schedule the end-of-session alarm. The OS fires this even when the app is
 * backgrounded or killed, which the in-page chime cannot do — a WebView that
 * isn't running plays no sound.
 */
export async function scheduleAlarm(fireAt, sessionType, soundId = DEFAULT_ALARM, soundEnabled = true) {
  if (!isNative) return
  const epoch = ++alarmEpoch
  // Wait out the permission prompt: the alarm screen is a notification with a
  // full-screen intent, so it needs notification permission to appear.
  const granted = await ensureAlarmPermission()
  if (!granted) return
  // The session may have been paused, reset or replaced while we waited.
  if (epoch !== alarmEpoch || fireAt <= Date.now()) return

  const { title, body } = COPY[sessionType] ?? COPY.work
  try {
    await NativeAlarm.schedule({
      at: fireAt,
      title,
      body,
      // A silent choice still rings the screen; it just picks the quiet file.
      sound: soundEnabled ? soundFileFor(soundId) : 'alarm_silent',
    })
  } catch (err) {
    console.warn('Could not schedule alarm:', err)
  }
}

export async function cancelAlarm() {
  if (!isNative) return
  // Invalidate any schedule still waiting on the permission prompt.
  alarmEpoch++
  try {
    await NativeAlarm.cancel()
  } catch {
    // Nothing scheduled — not an error.
  }
}

/** Silence an alarm that is ringing right now. */
export async function stopRinging() {
  if (!isNative) return
  try {
    await NativeAlarm.stopRinging()
  } catch {
    // Nothing ringing — not an error.
  }
}

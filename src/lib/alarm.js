import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

// A single reused id — there is only ever one session running.
const ALARM_ID = 1

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
 * Schedule the end-of-session alert. The OS fires this even when the app is
 * backgrounded or killed, which the in-page beep cannot do — a WebView that
 * isn't running plays no sound.
 */
export async function scheduleAlarm(fireAt, sessionType) {
  if (!isNative) return
  const epoch = ++alarmEpoch
  // Wait out the permission prompt: scheduling while it is still pending is
  // rejected, and the session would silently end with no alert.
  const granted = await ensureAlarmPermission()
  if (!granted) return
  // The session may have been paused, reset or replaced while we waited.
  if (epoch !== alarmEpoch || fireAt <= Date.now()) return
  const { title, body } = COPY[sessionType] ?? COPY.work
  try {
    await clearScheduled()
    await LocalNotifications.schedule({
      notifications: [{
        id: ALARM_ID,
        title,
        body,
        // allowWhileIdle so Doze doesn't hold the alert until the phone wakes.
        schedule: { at: new Date(fireAt), allowWhileIdle: true },
      }],
    })
  } catch (err) {
    console.warn('Could not schedule alarm:', err)
  }
}

// Withdraw the queued alert without touching the epoch — used when replacing one
// schedule with another, where invalidating the live request would cancel the
// very alarm being set.
async function clearScheduled() {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ALARM_ID }] })
  } catch {
    // Nothing scheduled — not an error.
  }
}

export async function cancelAlarm() {
  if (!isNative) return
  // Invalidate any schedule still waiting on the permission prompt.
  alarmEpoch++
  await clearScheduled()
}

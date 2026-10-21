import { Capacitor, registerPlugin } from '@capacitor/core'

// Native-only: puts the phone in Do Not Disturb for the length of a focus
// session. Android's own filter is used rather than anything app-side, so
// alarms — including this app's end-of-session alarm — still come through.
const FocusMode = registerPlugin('FocusMode')

const isNative = Capacitor.isNativePlatform()

/** Only Android can silence the phone; the browser build hides the setting. */
export const focusModeSupported = isNative

/**
 * Do Not Disturb access is granted in system settings, not at runtime, so the
 * app has to ask every time rather than remember an answer.
 */
export async function isFocusAccessGranted() {
  if (!isNative) return false
  try {
    const { granted } = await FocusMode.isGranted()
    return !!granted
  } catch {
    return false
  }
}

/** Opens the system screen where the user grants the access. */
export async function requestFocusAccess() {
  if (!isNative) return
  try {
    await FocusMode.requestAccess()
  } catch (err) {
    console.warn('Could not open Do Not Disturb settings:', err)
  }
}

/** Turn the filter on for a session, or off again afterwards. */
export async function setFocusMode(enable) {
  if (!isNative) return
  try {
    await FocusMode.set({ enable })
  } catch (err) {
    console.warn('Could not change Do Not Disturb:', err)
  }
}

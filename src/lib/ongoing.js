import { Capacitor, registerPlugin } from '@capacitor/core'

// Native-only: a persistent notification showing the session counting down.
// The countdown is drawn by Android's own chronometer from the deadline, so it
// keeps ticking while the WebView is suspended.
const OngoingTimer = registerPlugin('OngoingTimer')

const isNative = Capacitor.isNativePlatform()

const mmss = (seconds) => {
  const s = Math.max(0, Math.round(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Show the live countdown for a running session. */
export async function showRunning(label, deadline) {
  if (!isNative) return
  try {
    await OngoingTimer.show({ label, deadline, running: true, detail: 'Running' })
  } catch (err) {
    console.warn('Could not show the running-timer notification:', err)
  }
}

/** Freeze the notification at the remaining time — a chronometer would run on. */
export async function showPaused(label, timeLeft) {
  if (!isNative) return
  try {
    await OngoingTimer.show({
      label,
      deadline: 0,
      running: false,
      detail: `Paused · ${mmss(timeLeft)}`,
    })
  } catch (err) {
    console.warn('Could not update the running-timer notification:', err)
  }
}

export async function hideOngoing() {
  if (!isNative) return
  try {
    await OngoingTimer.hide()
  } catch {
    // Nothing showing — not an error.
  }
}

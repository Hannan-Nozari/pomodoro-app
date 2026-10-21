import { Capacitor, registerPlugin } from '@capacitor/core'
import { ensureAlarmPermission } from './alarm'

// Native-only: a persistent notification showing the session counting down.
// The countdown is drawn by Android's own chronometer from the deadline, so it
// keeps ticking while the WebView is suspended.
const OngoingTimer = registerPlugin('OngoingTimer')

const isNative = Capacitor.isNativePlatform()

/** Show the live countdown, progress bar and buttons for a running session. */
export async function showRunning(label, deadline, { task = '', session = '', total = 0, silence = false } = {}) {
  if (!isNative) return
  await post({ label, deadline, task, session, total, silence, running: true })
}

/** Freeze the notification at the remaining time — a chronometer would run on. */
export async function showPaused(label, timeLeft, { task = '', session = '', total = 0, silence = false } = {}) {
  if (!isNative) return
  await post({
    label,
    deadline: 0,
    running: false,
    remaining: Math.max(0, Math.round(timeLeft)),
    task,
    session,
    total,
    silence,
  })
}

/**
 * Hand the session to the native side, twice if need be.
 *
 * The first call is what mirrors the session into native storage, and it must
 * not wait for anything: the widget, the Quick Settings tile and the receiver
 * that rebuilds a session after a reboot all read that store, and the user may
 * leave the permission prompt sitting there. The notification itself is
 * dropped while permission is missing, so once it is granted the same payload
 * goes again — otherwise nothing would redraw it until the session changed.
 */
async function post(payload) {
  const send = async () => {
    try {
      await OngoingTimer.show(payload)
    } catch (err) {
      console.warn('Could not update the running-timer notification:', err)
    }
  }
  await send()
  if (await ensureAlarmPermission()) await send()
}

/**
 * Collect whatever the widget, the tile or the notification's own buttons did
 * while this layer was asleep.
 *
 * The widget and tile only park a request — they cannot run the timer. Pause,
 * Resume and Reset in the shade are different: they have already taken effect
 * natively, alarm and all, so what comes back here is news to be caught up
 * with, not an instruction to carry out.
 *
 * The session as the native side holds it comes back too. A pending action is
 * consumed once, so after a second relaunch it is gone, and only the state is
 * left to say what actually happened.
 */
export async function readNativeTimer() {
  if (!isNative) return null
  try {
    const state = await OngoingTimer.takeAction()
    return {
      action:    state.action ?? null,
      value:     state.value ?? 0,
      deadline:  state.deadline ?? 0,
      running:   !!state.running,
      paused:    !!state.paused,
      remaining: state.remaining ?? 0,
    }
  } catch {
    return null
  }
}

/**
 * Subscribe to the notification's own buttons while the app is alive.
 *
 * Pulling the shade down over the app does not hide the page, so there is no
 * visibility change to react to — the native side has to say so itself.
 */
export function onTimerAction(handler) {
  if (!isNative) return () => {}
  let remove = null
  let cancelled = false
  OngoingTimer.addListener('timerAction', handler)
    .then(h => { if (cancelled) h.remove(); else remove = h })
    .catch(() => {})
  return () => {
    cancelled = true
    if (remove) remove.remove()
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

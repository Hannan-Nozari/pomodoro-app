import presetData from './alarm-presets.json'

export const ALARM_PRESETS = presetData.presets
export const DEFAULT_ALARM = ALARM_PRESETS[0].id

// How a finished session announces itself. The ids are what the native
// AlarmService switches on, so they must match it.
export const ALERT_STYLES = [
  { id: 'alarm',        name: 'Ring like an alarm', detail: 'Wakes the screen and plays even on silent' },
  { id: 'notification', name: 'Notification',       detail: 'Notification volume, and follows silent mode' },
  { id: 'vibrate',      name: 'Vibrate only',       detail: 'No sound at all' },
]
export const DEFAULT_ALERT_STYLE = 'alarm'

export const presetName = (id) =>
  ALARM_PRESETS.find(p => p.id === id)?.name ?? ALARM_PRESETS[0].name

/** The res/raw file (and notification channel) matching a preset. */
export const soundFileFor = (id) => `alarm_${ALARM_PRESETS.some(p => p.id === id) ? id : DEFAULT_ALARM}`

function getContext(ctxRef) {
  if (!ctxRef.current) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    ctxRef.current = new Ctx()
  }
  if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
  return ctxRef.current
}

/**
 * Play an alarm preset through the Web Audio API.
 *
 * These are the same tones scripts/make-alarm-sounds.py renders to WAV for the
 * notification channels, so previewing a sound tells you what the alert will
 * actually sound like.
 */
export function playAlarm(ctxRef, id) {
  const preset = ALARM_PRESETS.find(p => p.id === id) ?? ALARM_PRESETS[0]
  try {
    const ctx = getContext(ctxRef)
    if (!ctx) return
    const now = ctx.currentTime

    for (const tone of preset.tones) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = tone.type ?? 'sine'
      osc.frequency.setValueAtTime(tone.freq, now + tone.at)
      gain.gain.setValueAtTime(tone.gain, now + tone.at)
      // exponentialRamp cannot reach 0; the WAV renderer uses the same curve.
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.at + tone.dur)
      osc.start(now + tone.at)
      osc.stop(now + tone.at + tone.dur)
    }
  } catch (err) {
    console.warn('Audio unavailable:', err)
  }
}

/** Open the audio output on a user gesture, or mobile keeps it suspended. */
export function primeAudio(ctxRef) {
  try {
    getContext(ctxRef)
  } catch {
    // No Web Audio — the OS notification still carries the alert.
  }
}

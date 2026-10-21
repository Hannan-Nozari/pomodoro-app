import { useState, useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { scheduleAlarm, cancelAlarm, ensureAlarmPermission, stopRinging } from '../lib/alarm'
import {
  showRunning, showPaused, hideOngoing, readNativeTimer, onTimerAction,
} from '../lib/ongoing'
import {
  focusModeSupported, isFocusAccessGranted, requestFocusAccess, setFocusMode,
} from '../lib/focus'
import { playAlarm, primeAudio, DEFAULT_ALARM, ALERT_STYLES, DEFAULT_ALERT_STYLE } from '../lib/sounds'

// On the phone the native side announces the end of every session — it is the
// only thing still running when the screen is off — so the page's own chime
// would just play the same moment twice. It is the browser build's only alert.
const isNative = Capacitor.isNativePlatform()

// ─── localStorage helpers ────────────────────────────────────────────────────
const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// ─── Session type constants ──────────────────────────────────────────────────
export const SESSION_TYPES = {
  WORK:        'work',
  SHORT_BREAK: 'shortBreak',
  LONG_BREAK:  'longBreak',
}

export const SESSION_LABELS = {
  work:        'Focus Time',
  shortBreak:  'Short Break',
  longBreak:   'Long Break',
}

// After every N completed work sessions a long break is given
const LONG_BREAK_INTERVAL = 4

// ─── Main hook ───────────────────────────────────────────────────────────────
export function usePomodoro() {
  // --- Persisted settings ---
  const [durations, setDurationsState] = useState(() => load('pomo_durations', {
    work:       25,
    shortBreak:  5,
    longBreak:  15,
  }))
  // How a finished session announces itself. It replaced an on/off sound
  // toggle, and "off" carries over as vibrate-only, the closest thing to it.
  const [alertStyle,   setAlertStyleState]   = useState(() => {
    const saved = load('pomo_alert_style', null)
    if (ALERT_STYLES.some(s => s.id === saved)) return saved
    return load('pomo_sound', true) === false ? 'vibrate' : DEFAULT_ALERT_STYLE
  })
  const soundEnabled = alertStyle !== 'vibrate'
  const [alarmSound,   setAlarmSoundState]   = useState(() => load('pomo_alarm', DEFAULT_ALARM))
  const [dndEnabled,   setDndEnabledState]   = useState(() => load('pomo_dnd', false))
  const [tasks,        setTasksState]        = useState(() => load('pomo_tasks', []))
  const [activeTaskId, setActiveTaskIdState]  = useState(() => load('pomo_active_task', null))
  const [history,      setHistoryState]      = useState(() => load('pomo_history', []))

  // --- Restored session ---
  // A phone kills backgrounded apps freely, so the in-flight session is written
  // to storage and picked back up on launch. `deadline` is the wall-clock time
  // the session ends, which is what makes an accurate resume possible.
  // Read once at mount: this runs on every render otherwise, and the values
  // must describe the moment the app opened, not the latest render.
  const restoredRef = useRef(null)
  if (restoredRef.current === null) {
    const saved = load('pomo_session', null)
    restoredRef.current = {
      saved,
      remaining: saved?.deadline
        ? Math.round((saved.deadline - Date.now()) / 1000)
        : null,
    }
  }
  const { saved: restored, remaining: restoredRemaining } = restoredRef.current

  // --- Runtime state ---
  const [sessionType,  setSessionType]  = useState(restored?.sessionType ?? SESSION_TYPES.WORK)
  const [workCount,    setWorkCount]    = useState(restored?.workCount ?? 0)   // completed work sessions
  const [sessionNum,   setSessionNum]   = useState(restored?.sessionNum ?? 1)  // display counter (resets on long break)
  const [timeLeft,     setTimeLeft]     = useState(() => {
    if (restoredRemaining !== null) return Math.max(0, restoredRemaining)
    if (Number.isFinite(restored?.timeLeft)) return restored.timeLeft
    return durations.work * 60
  })
  // Only resume ticking if the session still has time left; one that expired
  // while the app was closed is settled by the mount effect below.
  const [isRunning,    setIsRunning]    = useState(restoredRemaining > 0)
  const [isFinished,   setIsFinished]   = useState(false)

  const intervalRef  = useRef(null)
  const audioCtxRef  = useRef(null)
  // Wall-clock deadline for the running session. Ticking off a timestamp keeps
  // the countdown honest when the OS throttles or suspends timers (mobile
  // backgrounding, sleeping laptops) — counting interval fires would drift.
  const deadlineRef  = useRef(null)

  // Keep a ref so the interval callback always sees the latest values
  const stateRef = useRef({})
  stateRef.current = { timeLeft, isRunning, sessionType, workCount, sessionNum, durations, soundEnabled, alertStyle, alarmSound, history, tasks, activeTaskId, dndEnabled }

  // ── Persist on change ──────────────────────────────────────────────────────
  useEffect(() => { save('pomo_durations', durations)   }, [durations])
  useEffect(() => { save('pomo_alert_style', alertStyle) }, [alertStyle])
  useEffect(() => { save('pomo_alarm',     alarmSound)   }, [alarmSound])
  useEffect(() => { save('pomo_dnd',       dndEnabled)   }, [dndEnabled])
  useEffect(() => { save('pomo_tasks',     tasks)        }, [tasks])
  useEffect(() => { save('pomo_active_task', activeTaskId) }, [activeTaskId])
  useEffect(() => { save('pomo_history',   history)      }, [history])

  // ── Update browser tab title ───────────────────────────────────────────────
  useEffect(() => {
    const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0')
    const ss = String(timeLeft % 60).padStart(2, '0')
    document.title = `${mm}:${ss} — ${SESSION_LABELS[sessionType]}`
    return () => { document.title = 'Pomodoro Timer' }
  }, [timeLeft, sessionType])

  // ── Advance to the next session ────────────────────────────────────────────
  // `completedAt` is when the session actually ran out, which is not always now:
  // a session can expire while the app is closed and only be settled on launch.
  const advanceSession = useCallback((completedAt = Date.now()) => {
    const { sessionType, workCount, sessionNum, durations, soundEnabled, alarmSound,
            history, tasks, activeTaskId } = stateRef.current

    if (soundEnabled && !isNative) playAlarm(audioCtxRef, alarmSound)

    if (sessionType === SESSION_TYPES.WORK) {
      const newWorkCount = workCount + 1
      setWorkCount(newWorkCount)

      // Record in history
      const finishedAt = new Date(completedAt)
      const task = tasks.find(t => t.id === activeTaskId)
      const entry = {
        id:        completedAt,
        label:     SESSION_LABELS.work,
        session:   sessionNum,
        // Length and task are what the stats and per-task totals are built
        // from; the formatted strings below are only for display.
        minutes:   durations.work,
        taskId:    task ? task.id : undefined,
        taskText:  task ? task.text : undefined,
        timestamp: finishedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date:      finishedAt.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      }
      // Keep enough history for a few weeks of stats, not just a short list.
      const newHistory = [entry, ...history].slice(0, 200)
      setHistoryState(newHistory)

      // Determine break type
      if (newWorkCount % LONG_BREAK_INTERVAL === 0) {
        setSessionType(SESSION_TYPES.LONG_BREAK)
        setTimeLeft(durations.longBreak * 60)
      } else {
        setSessionType(SESSION_TYPES.SHORT_BREAK)
        setTimeLeft(durations.shortBreak * 60)
      }
    } else {
      // After any break, back to work
      const nextSessionNum = sessionType === SESSION_TYPES.LONG_BREAK ? 1 : sessionNum + 1
      setSessionNum(nextSessionNum)
      setSessionType(SESSION_TYPES.WORK)
      setTimeLeft(durations.work * 60)
    }

    hideOngoing()
    setIsRunning(false)
    setIsFinished(true)
  }, [])

  // What the notification shows besides the countdown: the task being worked
  // on, where this sits in the set of four, and the full length, which is what
  // its progress bar is drawn from.
  const ongoingDetail = useCallback(() => {
    const { sessionType, sessionNum, durations, tasks, activeTaskId, dndEnabled } = stateRef.current
    const isWork = sessionType === SESSION_TYPES.WORK
    return {
      task: isWork ? (tasks.find(t => t.id === activeTaskId)?.text ?? '') : '',
      session: isWork
        ? `Session ${Math.min(sessionNum, LONG_BREAK_INTERVAL)} of ${LONG_BREAK_INTERVAL}`
        : '',
      total: durations[sessionType] * 60,
      // Whether this session silences the phone, so that a Resume from the
      // shade can put it back into Do Not Disturb with nothing of this running.
      silence: !!dndEnabled && isWork,
    }
  }, [])

  // ── Catch up with whatever happened while the app was not running ─────────
  // Two things can have moved on without this layer: a session can have ended
  // while the app was closed, and the widget, the tile or the notification's
  // own buttons can have been used. Both are reconciled here, in that order,
  // so a session that really did finish is still logged before anything the
  // user has since asked for is applied.
  const settledRef = useRef(false)
  // Until the native side has been read once, this layer does not know whether
  // the session it restored is the current one, so it holds off on telling the
  // shade anything.
  // (the browser build has no native side to sync with, so it starts synced)
  const [synced, setSynced] = useState(!isNative)
  useEffect(() => {
    let cancelled = false

    const settle = () => {
      if (settledRef.current) return
      settledRef.current = true
      const expired = restoredRemaining !== null
        ? restoredRemaining <= 0
        : restored?.timeLeft === 0
      if (expired) {
        // The user is looking at the app now, so stop the alarm ringing.
        stopRinging()
        // Log it at the deadline it actually reached, not at app launch.
        advanceSession(restored?.deadline ?? Date.now())
      }
    }

    const apply = ({ action, value, deadline }) => {
      if (action === 'start' || action === 'resume') {
        if (stateRef.current.isRunning) return
        // A Resume in the shade already set a deadline and re-armed the alarm;
        // adopt that one rather than starting a different session.
        if (action === 'resume' && deadline > Date.now()) {
          setTimeLeft(Math.round((deadline - Date.now()) / 1000))
        }
        ensureAlarmPermission()
        stopRinging()
        setIsFinished(false)
        setIsRunning(true)
        return
      }
      if (action === 'pause') {
        deadlineRef.current = null
        setTimeLeft(Math.max(0, value))
        setIsRunning(false)
        return
      }
      if (action === 'reset') {
        const { durations, sessionType } = stateRef.current
        deadlineRef.current = null
        setIsRunning(false)
        setIsFinished(false)
        setTimeLeft(durations[sessionType] * 60)
      }
    }

    // Second line of defence, for when the action has already been consumed by
    // an earlier launch and only the native session itself is left to go on.
    const adopt = ({ running, paused, deadline, remaining }) => {
      const now = Date.now()
      if (running && deadline > now) {
        if (stateRef.current.isRunning) return
        setTimeLeft(Math.round((deadline - now) / 1000))
        setIsFinished(false)
        setIsRunning(true)
        return
      }
      if (paused && remaining > 0 && stateRef.current.isRunning) {
        deadlineRef.current = null
        setTimeLeft(remaining)
        setIsRunning(false)
      }
    }

    const collect = async (first = false) => {
      const native = await readNativeTimer()
      if (cancelled) return
      const action = native?.action ?? null
      // A pause or reset in the shade makes the saved session stale: it is not
      // an expired session, so it must not be logged as one. Nor is one the
      // native side is still counting down.
      if (action === 'pause' || action === 'reset') settledRef.current = true
      if (first && native?.running && native.deadline > Date.now()) {
        settledRef.current = true
      }
      settle()
      if (action) apply(native)
      else if (first && native) adopt(native)
      if (first) setSynced(true)
    }

    collect(true)
    // The app is often already open when one of those surfaces is used, so
    // check again on every return to the foreground, and whenever the native
    // side says a notification button was pressed — the shade opens over a
    // page that never stops being visible, so that is not a return.
    const onVisible = () => { if (!document.hidden) collect() }
    document.addEventListener('visibilitychange', onVisible)
    const offNative = onTimerAction(() => { collect() })
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      offNative()
    }
  }, [advanceSession, restoredRemaining, restored])

  // ── Tick interval ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) {
      clearInterval(intervalRef.current)
      deadlineRef.current = null
      // Deliberately no cancelAlarm() here. Reaching 00:00 also clears
      // isRunning, and cancelling on that path races the OS: if the WebView is
      // still alive it withdraws the alert at the moment it is due. The alarm
      // is instead cancelled explicitly by pause / reset / switch.
      return
    }

    deadlineRef.current = Date.now() + stateRef.current.timeLeft * 1000

    const tick = () => {
      const remaining = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) {
        clearInterval(intervalRef.current)
        deadlineRef.current = null
        // Schedule advanceSession outside setState to avoid stale closure issues
        setTimeout(() => advanceSession(), 0)
      }
    }

    intervalRef.current = setInterval(tick, 250)

    // Hand the end time to the OS as well: the alert has to fire even if the
    // WebView is suspended or the app has been killed by then.
    scheduleAlarm(
      deadlineRef.current,
      stateRef.current.sessionType,
      stateRef.current.alarmSound,
      stateRef.current.alertStyle,
    )
    showRunning(SESSION_LABELS[stateRef.current.sessionType], deadlineRef.current, ongoingDetail())

    // Re-sync the moment the app comes back to the foreground, so the display
    // is correct immediately instead of at the next tick.
    const onVisible = () => { if (!document.hidden && deadlineRef.current) tick() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isRunning, advanceSession, ongoingDetail])

  // A held session also belongs in the shade, and there is not always a
  // transition to hang it on: the app can be relaunched straight into one, or
  // paused from the notification's own button. So it follows the state rather
  // than the event.
  useEffect(() => {
    if (!synced || isRunning || isFinished) return
    const total = durations[sessionType] * 60
    if (timeLeft <= 0 || timeLeft >= total) {
      hideOngoing()
      return
    }
    showPaused(SESSION_LABELS[sessionType], timeLeft, ongoingDetail())
  }, [synced, isRunning, isFinished, timeLeft, sessionType, durations, ongoingDetail])

  // Snapshot the in-flight session so a killed app can resume it. This must be
  // declared after the tick effect: effects run in declaration order, and the
  // deadline is set there, so running first would persist deadline:null for a
  // session that has just started.
  useEffect(() => {
    save('pomo_session', {
      sessionType,
      workCount,
      sessionNum,
      timeLeft,
      deadline: isRunning ? deadlineRef.current : null,
    })
  }, [sessionType, workCount, sessionNum, timeLeft, isRunning])

  // ── Do Not Disturb during focus ────────────────────────────────────────────
  // Only ever undo our own silencing: the flag is persisted, so an app that was
  // killed mid-session still lifts the filter on next launch, while a Do Not
  // Disturb the user set themselves is left exactly as they left it.
  const dndOwnedRef = useRef(load('pomo_dnd_active', false))
  useEffect(() => {
    if (!focusModeSupported) return
    const silence = dndEnabled && isRunning && sessionType === SESSION_TYPES.WORK
    if (silence === dndOwnedRef.current) return
    dndOwnedRef.current = silence
    save('pomo_dnd_active', silence)
    setFocusMode(silence)
  }, [dndEnabled, isRunning, sessionType])

  // ── Controls ───────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    // Open the audio output here, while we still have a user gesture — mobile
    // browsers keep a context created later (at session end) suspended, which
    // would silence the chime.
    primeAudio(audioCtxRef)

    ensureAlarmPermission()
    stopRinging()
    setIsFinished(false)
    setIsRunning(true)
  }, [])

  // Each of these abandons the pending session, so the queued alert has to go
  // with it — otherwise it fires for a session the user already stopped.
  const pause = useCallback(() => {
    cancelAlarm()
    setIsRunning(false)
  }, [])

  const reset = useCallback(() => {
    cancelAlarm()
    hideOngoing()
    setIsRunning(false)
    setIsFinished(false)
    const { durations, sessionType } = stateRef.current
    setTimeLeft(durations[sessionType] * 60)
  }, [])

  // Jump directly to a session type (used when editing durations)
  const switchTo = useCallback((type) => {
    cancelAlarm()
    hideOngoing()
    setIsRunning(false)
    setIsFinished(false)
    setSessionType(type)
    setTimeLeft(stateRef.current.durations[type] * 60)
  }, [])

  // ── Duration updates ───────────────────────────────────────────────────────
  const setDurations = useCallback((newDurations) => {
    setDurationsState(newDurations)
    // If not running, immediately reflect the new duration for the current session
    if (!stateRef.current.isRunning) {
      setTimeLeft(newDurations[stateRef.current.sessionType] * 60)
    }
  }, [])

  /**
   * A running session's alert was armed in the old style, so it is re-armed
   * here; otherwise the change would only take effect from the next session.
   */
  const setAlertStyle = useCallback((style) => {
    setAlertStyleState(style)
    const { isRunning, sessionType, alarmSound } = stateRef.current
    if (isRunning && deadlineRef.current) {
      scheduleAlarm(deadlineRef.current, sessionType, alarmSound, style)
    }
  }, [])

  const setAlarmSound = useCallback((id) => {
    setAlarmSoundState(id)
    const { isRunning, sessionType, alertStyle } = stateRef.current
    if (isRunning && deadlineRef.current) {
      scheduleAlarm(deadlineRef.current, sessionType, id, alertStyle)
    }
  }, [])

  // Whether Android has given us permission to change Do Not Disturb. It is
  // granted on a system screen we can only open, never from inside the app, so
  // it is re-checked whenever the user comes back.
  const [dndGranted, setDndGranted] = useState(false)
  useEffect(() => {
    if (!focusModeSupported) return
    let alive = true
    const check = () => { isFocusAccessGranted().then(g => { if (alive) setDndGranted(g) }) }
    check()
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  /** Turning it on the first time sends the user to grant the access. */
  const setDndEnabled = useCallback(async (val) => {
    setDndEnabledState(val)
    if (val && focusModeSupported && !(await isFocusAccessGranted())) {
      await requestFocusAccess()
    }
  }, [])

  /** Play a sound on demand, for the previews in settings. */
  const previewAlarm = useCallback((id) => {
    primeAudio(audioCtxRef)
    playAlarm(audioCtxRef, id)
  }, [])

  // ── Task helpers ───────────────────────────────────────────────────────────
  const addTask = useCallback((text) => {
    if (!text.trim()) return
    setTasksState(prev => [
      { id: Date.now(), text: text.trim(), done: false },
      ...prev,
    ])
  }, [])

  const toggleTask = useCallback((id) => {
    setTasksState(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }, [])

  const deleteTask = useCallback((id) => {
    setTasksState(prev => prev.filter(t => t.id !== id))
    setActiveTaskIdState(prev => (prev === id ? null : prev))
  }, [])

  /** Choose what the next focus sessions count towards; tapping again clears it. */
  const setActiveTask = useCallback((id) => {
    setActiveTaskIdState(prev => (prev === id ? null : id))
  }, [])

  const clearHistory = useCallback(() => {
    setHistoryState([])
  }, [])

  /** Attach (or clear) a note on a finished session. */
  const setSessionNote = useCallback((id, note) => {
    const text = note.trim()
    setHistoryState(prev => prev.map(entry =>
      entry.id === id ? { ...entry, note: text || undefined } : entry
    ))
  }, [])

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalSeconds  = durations[sessionType] * 60
  const progress      = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0
  // Display session number out of LONG_BREAK_INTERVAL
  const displaySession = ((workCount % LONG_BREAK_INTERVAL) || (sessionType === SESSION_TYPES.LONG_BREAK ? LONG_BREAK_INTERVAL : 0)) || sessionNum

  return {
    // Timer state
    timeLeft,
    sessionType,
    sessionNum,
    workCount,
    isRunning,
    isFinished,
    progress,
    totalSessions: LONG_BREAK_INTERVAL,
    displaySession: Math.min(sessionNum, LONG_BREAK_INTERVAL),

    // Controls
    start, pause, reset, switchTo,

    // Settings
    durations, setDurations,
    alertStyle, setAlertStyle, soundEnabled, nativeAlerts: isNative,
    alarmSound, setAlarmSound, previewAlarm,
    dndEnabled, setDndEnabled, dndGranted, dndSupported: focusModeSupported,
    requestDndAccess: requestFocusAccess,

    // Tasks
    tasks, addTask, toggleTask, deleteTask,
    activeTaskId, setActiveTask,
    activeTask: tasks.find(t => t.id === activeTaskId) ?? null,

    // History
    history, clearHistory, setSessionNote,
  }
}

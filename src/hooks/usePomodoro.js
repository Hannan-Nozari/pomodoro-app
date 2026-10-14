import { useState, useEffect, useRef, useCallback } from 'react'
import { scheduleAlarm, cancelAlarm, ensureAlarmPermission, usesNativeAlarm } from '../lib/alarm'

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

// ─── Simple beep via Web Audio API (no external files needed) ────────────────
function playBeep(audioCtxRef) {
  try {
    // Reuse or create an AudioContext
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    const ctx = audioCtxRef.current

    // Two quick beeps
    const beepAt = (startTime) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type      = 'sine'
      osc.frequency.setValueAtTime(880, startTime)          // A5 note
      gain.gain.setValueAtTime(0.4, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3)
      osc.start(startTime)
      osc.stop(startTime + 0.3)
    }

    const now = ctx.currentTime
    beepAt(now)
    beepAt(now + 0.4)
  } catch (err) {
    // Web Audio API not available — silently ignore
    console.warn('Audio unavailable:', err)
  }
}

// ─── Main hook ───────────────────────────────────────────────────────────────
export function usePomodoro() {
  // --- Persisted settings ---
  const [durations, setDurationsState] = useState(() => load('pomo_durations', {
    work:       25,
    shortBreak:  5,
    longBreak:  15,
  }))
  const [soundEnabled, setSoundEnabledState] = useState(() => load('pomo_sound', true))
  const [tasks,        setTasksState]        = useState(() => load('pomo_tasks', []))
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
        ? Math.ceil((saved.deadline - Date.now()) / 1000)
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
  const deadlineRef  = useRef(restored?.deadline ?? null)

  // Keep a ref so the interval callback always sees the latest values
  const stateRef = useRef({})
  stateRef.current = { timeLeft, isRunning, sessionType, workCount, sessionNum, durations, soundEnabled, history }

  // ── Persist on change ──────────────────────────────────────────────────────
  useEffect(() => { save('pomo_durations', durations)   }, [durations])
  useEffect(() => { save('pomo_sound',     soundEnabled) }, [soundEnabled])
  useEffect(() => { save('pomo_tasks',     tasks)        }, [tasks])
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
    const { sessionType, workCount, sessionNum, durations, soundEnabled, history } = stateRef.current

    if (soundEnabled && !usesNativeAlarm) playBeep(audioCtxRef)

    if (sessionType === SESSION_TYPES.WORK) {
      const newWorkCount = workCount + 1
      setWorkCount(newWorkCount)

      // Record in history
      const finishedAt = new Date(completedAt)
      const entry = {
        id:        completedAt,
        label:     SESSION_LABELS.work,
        session:   sessionNum,
        timestamp: finishedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date:      finishedAt.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      }
      const newHistory = [entry, ...history].slice(0, 50) // cap at 50 entries
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

    setIsRunning(false)
    setIsFinished(true)
  }, [])

  // ── Settle a session that ended while the app was closed ───────────────────
  // The OS notification already alerted the user; this catches the app up so
  // the session is logged and the next one is queued.
  const settledRef = useRef(false)
  useEffect(() => {
    if (settledRef.current) return
    settledRef.current = true
    const expired = restoredRemaining !== null
      ? restoredRemaining <= 0
      : restored?.timeLeft === 0
    if (expired) {
      // Log it at the deadline it actually reached, not at app launch.
      advanceSession(restored?.deadline ?? Date.now())
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

    // Keep a restored deadline, including its milliseconds. Recreating it from
    // the rounded display adds drift every time Android recreates the WebView.
    deadlineRef.current ??= Date.now() + stateRef.current.timeLeft * 1000

    const tick = () => {
      if (deadlineRef.current === null) return
      const completedAt = deadlineRef.current
      const remaining = Math.max(0, Math.ceil((completedAt - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) {
        clearInterval(intervalRef.current)
        deadlineRef.current = null
        advanceSession(completedAt)
      }
    }

    intervalRef.current = setInterval(tick, 250)

    // Re-sync the moment the app comes back to the foreground, so the display
    // is correct immediately instead of at the next tick.
    const onVisible = () => { if (!document.hidden && deadlineRef.current) tick() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isRunning, advanceSession])

  // Sound changes replace the OS alert without restarting the countdown.
  useEffect(() => {
    if (isRunning && deadlineRef.current !== null) {
      scheduleAlarm(deadlineRef.current, sessionType, soundEnabled)
    }
  }, [isRunning, sessionType, soundEnabled])

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

  // ── Controls ───────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    // Create/resume the AudioContext here, while we still have a user gesture —
    // mobile browsers keep a context created later (at session end) suspended,
    // which would silence the alarm.
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    } catch {}

    ensureAlarmPermission()
    setIsFinished(false)
    setIsRunning(true)
  }, [])

  // Each of these abandons the pending session, so the queued alert has to go
  // with it — otherwise it fires for a session the user already stopped.
  const pause = useCallback(() => {
    if (deadlineRef.current !== null) {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
      if (remaining === 0) {
        const completedAt = deadlineRef.current
        deadlineRef.current = null
        clearInterval(intervalRef.current)
        advanceSession(completedAt)
        return
      }
      setTimeLeft(remaining)
    }
    cancelAlarm()
    setIsRunning(false)
  }, [advanceSession])

  const reset = useCallback(() => {
    cancelAlarm()
    setIsRunning(false)
    setIsFinished(false)
    const { durations, sessionType } = stateRef.current
    setTimeLeft(durations[sessionType] * 60)
  }, [])

  // Jump directly to a session type (used when editing durations)
  const switchTo = useCallback((type) => {
    cancelAlarm()
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

  const setSoundEnabled = useCallback((val) => {
    setSoundEnabledState(val)
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
  }, [])

  const clearHistory = useCallback(() => {
    setHistoryState([])
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
    soundEnabled, setSoundEnabled,

    // Tasks
    tasks, addTask, toggleTask, deleteTask,

    // History
    history, clearHistory,
  }
}

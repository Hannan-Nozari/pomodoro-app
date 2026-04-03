import { useState, useEffect, useRef, useCallback } from 'react'

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

  // --- Runtime state ---
  const [sessionType,  setSessionType]  = useState(SESSION_TYPES.WORK)
  const [workCount,    setWorkCount]    = useState(0)   // completed work sessions
  const [sessionNum,   setSessionNum]   = useState(1)   // display counter (resets on long break)
  const [timeLeft,     setTimeLeft]     = useState(durations.work * 60)
  const [isRunning,    setIsRunning]    = useState(false)
  const [isFinished,   setIsFinished]   = useState(false)

  const intervalRef  = useRef(null)
  const audioCtxRef  = useRef(null)

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
  const advanceSession = useCallback(() => {
    const { sessionType, workCount, sessionNum, durations, soundEnabled, history } = stateRef.current

    if (soundEnabled) playBeep(audioCtxRef)

    if (sessionType === SESSION_TYPES.WORK) {
      const newWorkCount = workCount + 1
      setWorkCount(newWorkCount)

      // Record in history
      const entry = {
        id:        Date.now(),
        label:     SESSION_LABELS.work,
        session:   sessionNum,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date:      new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
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

  // ── Tick interval ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current)
            // Schedule advanceSession outside setState to avoid stale closure issues
            setTimeout(advanceSession, 0)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [isRunning, advanceSession])

  // ── Controls ───────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    setIsFinished(false)
    setIsRunning(true)
  }, [])

  const pause = useCallback(() => {
    setIsRunning(false)
  }, [])

  const reset = useCallback(() => {
    setIsRunning(false)
    setIsFinished(false)
    const { durations, sessionType } = stateRef.current
    setTimeLeft(durations[sessionType] * 60)
  }, [])

  // Jump directly to a session type (used when editing durations)
  const switchTo = useCallback((type) => {
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

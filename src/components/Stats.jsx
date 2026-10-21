import React, { useMemo } from 'react'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const startOfDay = (ms) => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const formatDuration = (minutes) => {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/**
 * Everything here is derived from the session history already on the device —
 * the entry id is the moment the session finished, so the clock times come
 * from the data rather than from anything extra being recorded.
 */
function summarise(history) {
  const today = startOfDay(Date.now())
  const weekStart = today - 6 * DAY_MS

  // Seven buckets, oldest first, so the chart reads left to right.
  const days = Array.from({ length: 7 }, (_, i) => {
    const dayStart = weekStart + i * DAY_MS
    return { dayStart, label: DAY_LABELS[new Date(dayStart).getDay()], sessions: 0, minutes: 0 }
  })

  const byHour = new Array(24).fill(0)
  const byTask = new Map()
  let weekSessions = 0
  let weekMinutes = 0

  for (const entry of history) {
    const at = Number(entry.id)
    if (!Number.isFinite(at)) continue
    const minutes = Number.isFinite(entry.minutes) ? entry.minutes : 25

    byHour[new Date(at).getHours()] += 1

    if (entry.taskText) {
      byTask.set(entry.taskText, (byTask.get(entry.taskText) ?? 0) + minutes)
    }

    const day = startOfDay(at)
    if (day >= weekStart && day <= today) {
      const bucket = days[Math.round((day - weekStart) / DAY_MS)]
      if (bucket) {
        bucket.sessions += 1
        bucket.minutes += minutes
      }
      weekSessions += 1
      weekMinutes += minutes
    }
  }

  // Streak: consecutive days ending today (or yesterday, if today is young).
  const daysWithSessions = new Set(history.map(e => startOfDay(Number(e.id))))
  let streak = 0
  let cursor = daysWithSessions.has(today) ? today : today - DAY_MS
  while (daysWithSessions.has(cursor)) {
    streak += 1
    cursor -= DAY_MS
  }

  const peakHour = byHour.some(Boolean) ? byHour.indexOf(Math.max(...byHour)) : null
  const topTasks = [...byTask.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

  return { days, weekSessions, weekMinutes, streak, peakHour, topTasks }
}

const hourLabel = (h) => {
  const period = h < 12 ? 'am' : 'pm'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}${period}`
}

function Figure({ value, caption }) {
  return (
    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-center">
      <p className="text-lg font-semibold text-gray-700 tabular-nums leading-tight">{value}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{caption}</p>
    </div>
  )
}

// ─── Weekly summary ───────────────────────────────────────────────────────────
export default function Stats({ history }) {
  const { days, weekSessions, weekMinutes, streak, peakHour, topTasks } =
    useMemo(() => summarise(history), [history])

  if (history.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          This week
        </h3>
        <p className="text-sm text-gray-300 text-center py-4">
          Finish a session and your focus pattern shows up here.
        </p>
      </div>
    )
  }

  const busiest = Math.max(...days.map(d => d.minutes), 1)

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        This week
      </h3>

      <div className="flex gap-2">
        <Figure value={formatDuration(weekMinutes)} caption="focused" />
        <Figure value={weekSessions} caption={weekSessions === 1 ? 'session' : 'sessions'} />
        <Figure value={streak} caption={streak === 1 ? 'day streak' : 'day streak'} />
      </div>

      {/* Seven-day bars, today on the right */}
      <div className="flex items-end justify-between gap-1.5 h-20 mt-4" aria-hidden="true">
        {days.map((day, i) => (
          <div key={day.dayStart} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-t transition-all ${day.minutes > 0 ? 'bg-tomato' : 'bg-gray-100'}`}
              style={{ height: `${day.minutes > 0 ? Math.max(8, (day.minutes / busiest) * 56) : 3}px` }}
            />
            <span className={`text-[10px] ${i === days.length - 1 ? 'text-gray-600 font-medium' : 'text-gray-400'}`}>
              {day.label}
            </span>
          </div>
        ))}
      </div>
      <p className="sr-only">
        {days.map(d => `${d.label}: ${formatDuration(d.minutes)}`).join(', ')}
      </p>

      {peakHour !== null && (
        <p className="text-xs text-gray-400 mt-3">
          You focus most around{' '}
          <span className="text-gray-600 font-medium">{hourLabel(peakHour)}</span>.
        </p>
      )}

      {topTasks.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Time per task
          </h4>
          <ul className="space-y-1">
            {topTasks.map(([text, minutes]) => (
              <li key={text} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-600 truncate">{text}</span>
                <span className="text-gray-400 text-xs tabular-nums flex-shrink-0">
                  {formatDuration(minutes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

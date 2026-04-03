import React from 'react'
import { SESSION_LABELS, SESSION_TYPES } from '../hooks/usePomodoro'

// ─── Circular SVG progress ring ───────────────────────────────────────────────
function ProgressRing({ progress, sessionType }) {
  const radius      = 110
  const stroke      = 8
  const normalised  = radius - stroke / 2
  const circumference = 2 * Math.PI * normalised

  // Ring color by session type
  const ringColor = {
    [SESSION_TYPES.WORK]:        '#E05252',
    [SESSION_TYPES.SHORT_BREAK]: '#52A8E0',
    [SESSION_TYPES.LONG_BREAK]:  '#52C4A0',
  }[sessionType] ?? '#E05252'

  return (
    <svg
      width={radius * 2}
      height={radius * 2}
      className="absolute inset-0 -rotate-90"
      aria-hidden="true"
    >
      {/* Background track */}
      <circle
        cx={radius}
        cy={radius}
        r={normalised}
        fill="none"
        stroke="#F0F0F0"
        strokeWidth={stroke}
      />
      {/* Progress arc */}
      <circle
        cx={radius}
        cy={radius}
        r={normalised}
        fill="none"
        stroke={ringColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
      />
    </svg>
  )
}

// ─── Session type pill badges ─────────────────────────────────────────────────
function SessionBadges({ sessionType, onSwitch, isRunning }) {
  const types = [
    { key: SESSION_TYPES.WORK,        label: 'Focus' },
    { key: SESSION_TYPES.SHORT_BREAK, label: 'Short Break' },
    { key: SESSION_TYPES.LONG_BREAK,  label: 'Long Break' },
  ]

  return (
    <div className="flex gap-2 justify-center flex-wrap">
      {types.map(({ key, label }) => {
        const active = sessionType === key
        return (
          <button
            key={key}
            onClick={() => !isRunning && onSwitch(key)}
            disabled={isRunning}
            aria-pressed={active}
            className={`
              px-3 py-1 rounded-full text-sm font-medium transition-colors
              ${active
                ? 'bg-tomato text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'}
            `}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main Timer component ─────────────────────────────────────────────────────
export default function Timer({
  timeLeft,
  sessionType,
  sessionNum,
  totalSessions,
  displaySession,
  isRunning,
  isFinished,
  progress,
  onStart,
  onPause,
  onReset,
  onSwitch,
}) {
  // Format seconds → MM:SS
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const ss = String(timeLeft % 60).padStart(2, '0')

  const ringSize = 220 // px — matches radius*2 in ProgressRing

  return (
    <div className="flex flex-col items-center gap-6">

      {/* Session type pills */}
      <SessionBadges
        sessionType={sessionType}
        onSwitch={onSwitch}
        isRunning={isRunning}
      />

      {/* Circular timer */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: ringSize, height: ringSize }}
      >
        <ProgressRing progress={progress} sessionType={sessionType} />

        <div className="flex flex-col items-center z-10">
          {/* Countdown digits */}
          <span
            className="font-mono text-6xl font-bold text-gray-800 tabular-nums leading-none"
            aria-live="polite"
            aria-label={`${mm} minutes ${ss} seconds remaining`}
          >
            {mm}:{ss}
          </span>

          {/* Session label */}
          <span className="mt-2 text-sm font-medium text-gray-400 tracking-wide uppercase">
            {SESSION_LABELS[sessionType]}
          </span>
        </div>
      </div>

      {/* Session counter */}
      <p className="text-sm text-gray-400">
        Session{' '}
        <span className="font-semibold text-gray-600">{displaySession}</span>
        {' '}of{' '}
        <span className="font-semibold text-gray-600">{totalSessions}</span>
      </p>

      {/* Finished message */}
      {isFinished && (
        <p className="text-tomato font-medium text-sm animate-pulse">
          Session complete — great work!
        </p>
      )}

      {/* Control buttons */}
      <div className="flex gap-3 items-center">
        {/* Reset */}
        <button
          onClick={onReset}
          aria-label="Reset timer"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
        >
          {/* Reload icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.28"/>
          </svg>
        </button>

        {/* Start / Pause — primary action */}
        <button
          onClick={isRunning ? onPause : onStart}
          aria-label={isRunning ? 'Pause timer' : 'Start timer'}
          className="w-20 h-20 rounded-full flex items-center justify-center bg-tomato text-white shadow-lg hover:bg-tomato-dark active:scale-95 transition-all text-xl font-bold"
        >
          {isRunning ? (
            // Pause icon
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            // Play icon
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 ml-1" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>

        {/* Spacer to keep Start centered */}
        <div className="w-10 h-10" aria-hidden="true" />
      </div>
    </div>
  )
}

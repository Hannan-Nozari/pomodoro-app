import React from 'react'

// ─── Session history list ─────────────────────────────────────────────────────
export default function SessionHistory({ history, onClear }) {
  if (history.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Session History
        </h3>
        <p className="text-sm text-gray-300 text-center py-4">
          No sessions yet — complete a focus session to see it here.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header with clear button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Session History
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* History entries */}
      <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {history.map((entry, idx) => (
          <li
            key={entry.id}
            className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0"
          >
            {/* Left: session label & number */}
            <div className="flex items-center gap-2">
              {/* Small tomato dot */}
              <span className="w-2 h-2 rounded-full bg-tomato flex-shrink-0" aria-hidden="true" />
              <span className="text-gray-700 font-medium">{entry.label}</span>
              <span className="text-gray-400 text-xs">#{history.length - idx}</span>
            </div>

            {/* Right: timestamp */}
            <span className="text-gray-400 text-xs tabular-nums">
              {entry.date} · {entry.timestamp}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-gray-400 mt-2 text-right">
        {history.length} session{history.length !== 1 ? 's' : ''} completed
      </p>
    </div>
  )
}

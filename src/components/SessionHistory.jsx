import React, { useState } from 'react'

// ─── One finished session, with its optional note ─────────────────────────────
function HistoryEntry({ entry, number, onNote }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.note ?? '')

  const commit = () => {
    setEditing(false)
    if (draft.trim() !== (entry.note ?? '')) onNote(entry.id, draft)
  }

  return (
    <li className="py-1.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center justify-between text-sm">
        {/* Left: session label & number */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Small tomato dot */}
          <span className="w-2 h-2 rounded-full bg-tomato flex-shrink-0" aria-hidden="true" />
          <span className="text-gray-700 font-medium">{entry.label}</span>
          <span className="text-gray-400 text-xs">#{number}</span>
        </div>

        {/* Right: timestamp and the note affordance */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-gray-400 text-xs tabular-nums">
            {entry.date} · {entry.timestamp}
          </span>
          <button
            onClick={() => { setDraft(entry.note ?? ''); setEditing(v => !v) }}
            aria-label={entry.note ? 'Edit note' : 'Add note'}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors flex-shrink-0
              ${entry.note ? 'text-tomato' : 'text-gray-300 hover:text-gray-500'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
        </div>
      </div>

      {editing ? (
        <input
          type="text"
          value={draft}
          autoFocus
          maxLength={140}
          placeholder="What did you work on?"
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') { setDraft(entry.note ?? ''); setEditing(false) }
          }}
          className="w-full mt-1.5 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-tomato focus:ring-1 focus:ring-tomato transition-colors placeholder:text-gray-300"
        />
      ) : entry.note ? (
        <p className="mt-1 ml-4 text-xs text-gray-500 break-words">{entry.note}</p>
      ) : null}

      {/* What the session counted towards, when a task was chosen for it */}
      {entry.taskText && !editing && (
        <p className="mt-0.5 ml-4 text-xs text-gray-400 truncate">{entry.taskText}</p>
      )}
    </li>
  )
}

// ─── Session history list ─────────────────────────────────────────────────────
export default function SessionHistory({ history, onClear, onNote }) {
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
          <HistoryEntry
            key={entry.id}
            entry={entry}
            number={history.length - idx}
            onNote={onNote}
          />
        ))}
      </ul>

      <p className="text-xs text-gray-400 mt-2 text-right">
        {history.length} session{history.length !== 1 ? 's' : ''} completed
      </p>
    </div>
  )
}

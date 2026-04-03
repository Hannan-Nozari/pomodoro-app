import React, { useState } from 'react'
import TaskList from './TaskList'
import SessionHistory from './SessionHistory'

// ─── Duration input field ─────────────────────────────────────────────────────
function DurationField({ label, value, onChange, min = 1, max = 90 }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={e => {
            const v = Number(e.target.value)
            if (v >= min && v <= max) onChange(v)
          }}
          className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center outline-none focus:border-tomato focus:ring-1 focus:ring-tomato tabular-nums transition-colors"
        />
        <span className="text-xs text-gray-400">min</span>
      </div>
    </div>
  )
}

// ─── Advanced panel ───────────────────────────────────────────────────────────
export default function AdvancedPanel({
  durations, onDurationsChange,
  soundEnabled, onSoundToggle,
  tasks, onAddTask, onToggleTask, onDeleteTask,
  history, onClearHistory,
}) {
  const [isOpen, setIsOpen] = useState(false)

  // Local draft so we only apply durations when all three are valid
  const [draft, setDraft] = useState(durations)

  // Apply whenever a field changes
  const handleChange = (key, val) => {
    const next = { ...draft, [key]: val }
    setDraft(next)
    onDurationsChange(next)
  }

  return (
    <div className="w-full">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 text-sm font-medium transition-colors"
      >
        <span>Advanced</span>
        {/* Chevron rotates when open */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Collapsible content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[9999px] opacity-100 mt-4' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex flex-col gap-6">

          {/* ── Duration settings ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Durations
            </h3>
            <div className="flex gap-4 flex-wrap">
              <DurationField
                label="Focus"
                value={draft.work}
                onChange={v => handleChange('work', v)}
              />
              <DurationField
                label="Short Break"
                value={draft.shortBreak}
                onChange={v => handleChange('shortBreak', v)}
              />
              <DurationField
                label="Long Break"
                value={draft.longBreak}
                onChange={v => handleChange('longBreak', v)}
              />
            </div>
          </div>

          {/* ── Sound toggle ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Notifications
            </h3>
            <button
              onClick={onSoundToggle}
              aria-pressed={soundEnabled}
              className="flex items-center gap-3 group"
            >
              {/* Toggle pill */}
              <span
                className={`
                  relative inline-flex w-10 h-6 rounded-full transition-colors duration-200
                  ${soundEnabled ? 'bg-tomato' : 'bg-gray-200'}
                `}
              >
                <span
                  className={`
                    absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                    ${soundEnabled ? 'translate-x-4' : 'translate-x-0'}
                  `}
                />
              </span>
              <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
                Sound notification
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* ── Task list ── */}
          <TaskList
            tasks={tasks}
            onAdd={onAddTask}
            onToggle={onToggleTask}
            onDelete={onDeleteTask}
          />

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* ── Session history ── */}
          <SessionHistory history={history} onClear={onClearHistory} />

        </div>
      </div>
    </div>
  )
}

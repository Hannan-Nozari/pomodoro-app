import React, { useState, useEffect } from 'react'
import TaskList from './TaskList'
import SessionHistory from './SessionHistory'
import { ALARM_PRESETS } from '../lib/sounds'

// ─── Alarm sound picker ───────────────────────────────────────────────────────
function AlarmPicker({ value, onChange, onPreview, disabled }) {
  return (
    <ul className={`flex flex-col gap-1 transition-opacity ${disabled ? 'opacity-40' : ''}`}>
      {ALARM_PRESETS.map(preset => {
        const active = preset.id === value
        return (
          <li key={preset.id} className="flex items-center gap-2">
            <button
              onClick={() => { onChange(preset.id); onPreview(preset.id) }}
              disabled={disabled}
              aria-pressed={active}
              className={`flex-1 flex items-center gap-2.5 text-left text-sm px-3 py-2 rounded-lg border transition-colors
                ${active
                  ? 'border-tomato bg-tomato/5 text-gray-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'}
                disabled:cursor-not-allowed`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors
                  ${active ? 'border-tomato bg-tomato' : 'border-gray-300'}`}
                aria-hidden="true"
              />
              {preset.name}
            </button>

            {/* Hear it without selecting it */}
            <button
              onClick={() => onPreview(preset.id)}
              disabled={disabled}
              aria-label={`Play ${preset.name}`}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Duration input field ─────────────────────────────────────────────────────
function DurationField({ label, value, onChange, min = 1, max = 90 }) {
  // The field keeps its own draft text so the box can be emptied mid-edit.
  // Validating on every keystroke would reject "" and trap the old digits,
  // making the value impossible to replace on a phone keyboard.
  const [draft, setDraft] = useState(String(value))

  // Follow the value when it changes from outside (e.g. a reset).
  useEffect(() => { setDraft(String(value)) }, [value])

  const commit = () => {
    const v = Number(draft)
    const clamped = Number.isFinite(v) && draft !== ''
      ? Math.min(max, Math.max(min, Math.round(v)))
      : value
    setDraft(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          value={draft}
          min={min}
          max={max}
          onChange={e => {
            const next = e.target.value
            setDraft(next)
            // Apply immediately while the value is in range; anything else
            // (empty, half-typed, out of bounds) settles on blur.
            const v = Number(next)
            if (next !== '' && v >= min && v <= max) onChange(v)
          }}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
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
  history, onClearHistory, onSessionNote,
  alarmSound, onAlarmSoundChange, onPreviewAlarm,
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

            <div className="mt-3">
              <AlarmPicker
                value={alarmSound}
                onChange={onAlarmSoundChange}
                onPreview={onPreviewAlarm}
                disabled={!soundEnabled}
              />
            </div>
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
          <SessionHistory
            history={history}
            onClear={onClearHistory}
            onNote={onSessionNote}
          />

        </div>
      </div>
    </div>
  )
}

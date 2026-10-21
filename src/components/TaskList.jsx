import React, { useState } from 'react'

// ─── Individual task row ───────────────────────────────────────────────────────
function TaskItem({ task, onToggle, onDelete, isActive, onSelect }) {
  return (
    <li className={`flex items-center gap-3 py-2 group rounded-lg transition-colors
      ${isActive ? 'bg-tomato/5 px-2 -mx-2' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id)}
        aria-label={task.done ? 'Mark task incomplete' : 'Mark task complete'}
        className={`
          flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center
          transition-colors
          ${task.done
            ? 'bg-tomato border-tomato'
            : 'border-gray-300 hover:border-tomato'}
        `}
      >
        {task.done && (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </button>

      {/* Tapping the text points the timer at this task */}
      <button
        onClick={() => onSelect(task.id)}
        disabled={task.done}
        aria-pressed={isActive}
        className={`flex-1 text-left text-sm truncate transition-colors disabled:cursor-not-allowed
          ${task.done ? 'line-through text-gray-400' : isActive ? 'text-tomato font-medium' : 'text-gray-700 hover:text-tomato'}`}
      >
        {task.text}
      </button>

      {isActive && !task.done && (
        <span className="text-[10px] font-semibold text-tomato uppercase tracking-wider flex-shrink-0">
          Focusing
        </span>
      )}

      {/* Delete button — visible on hover */}
      <button
        onClick={() => onDelete(task.id)}
        aria-label="Delete task"
        className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </li>
  )
}

// ─── Task list component ──────────────────────────────────────────────────────
export default function TaskList({ tasks, onAdd, onToggle, onDelete, activeTaskId, onSelect }) {
  const [input, setInput] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onAdd(input)
    setInput('')
  }

  const pending   = tasks.filter(t => !t.done)
  const completed = tasks.filter(t =>  t.done)

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Tasks
      </h3>

      {/* Add task form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a task…"
          maxLength={120}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-tomato focus:ring-1 focus:ring-tomato transition-colors placeholder:text-gray-300"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-3 py-2 rounded-lg bg-tomato text-white text-sm font-medium hover:bg-tomato-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </form>

      {/* Task list */}
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-300 text-center py-4">
          No tasks yet — add one above!
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {/* Pending tasks first */}
          {pending.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onDelete={onDelete}
              isActive={task.id === activeTaskId}
              onSelect={onSelect}
            />
          ))}
          {/* Completed tasks at the bottom */}
          {completed.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onDelete={onDelete}
              isActive={false}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}

      {/* Completion summary */}
      {tasks.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-right">
          {activeTaskId ? 'Tap a task to change what you are focusing on · ' : ''}
          {completed.length} / {tasks.length} done
        </p>
      )}
    </div>
  )
}

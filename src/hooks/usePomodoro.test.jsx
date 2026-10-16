import React from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePomodoro } from './usePomodoro'
import { scheduleAlarm, cancelAlarm } from '../lib/alarm'

vi.mock('../lib/alarm', () => ({
  scheduleAlarm: vi.fn(), cancelAlarm: vi.fn(),
  ensureAlarmPermission: vi.fn().mockResolvedValue(true), usesNativeAlarm: true,
}))

const now = new Date('2026-10-14T12:00:00Z').getTime()
function restore(overrides = {}) {
  localStorage.setItem('pomo_session', JSON.stringify({
    sessionType: 'work', workCount: 0, sessionNum: 1, timeLeft: 60,
    deadline: now + 60_123, ...overrides,
  }))
}
const strict = ({ children }) => <React.StrictMode>{children}</React.StrictMode>

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  localStorage.clear()
  localStorage.setItem('pomo_sound', 'false')
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('Android session lifecycle', () => {
  it('keeps the exact persisted deadline after a process restart and Strict Mode mount', () => {
    restore()
    const { result } = renderHook(usePomodoro, { wrapper: strict })
    expect(result.current.isRunning).toBe(true)
    expect(JSON.parse(localStorage.getItem('pomo_session')).deadline).toBe(now + 60_123)
    expect(scheduleAlarm).toHaveBeenLastCalledWith(now + 60_123, 'work', false)
  })

  it('does not finish half a second before the deadline', () => {
    restore({ deadline: now + 1_000, timeLeft: 1 })
    const { result } = renderHook(usePomodoro)
    act(() => vi.advanceTimersByTime(750))
    expect(result.current.isRunning).toBe(true)
    expect(result.current.timeLeft).toBe(1)
    act(() => vi.advanceTimersByTime(250))
    expect(result.current.sessionType).toBe('shortBreak')
    expect(result.current.history).toHaveLength(1)
  })

  it('settles a suspended session once, at its original deadline', () => {
    restore({ deadline: now + 10_000 })
    const { result } = renderHook(usePomodoro)
    act(() => {
      vi.setSystemTime(now + 300_000)
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].id).toBe(now + 10_000)
    expect(result.current.sessionType).toBe('shortBreak')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current.history).toHaveLength(1)
  })

  it('settles an expired killed session only once across remounts', () => {
    restore({ deadline: now - 5_000 })
    let mounted = renderHook(usePomodoro, { wrapper: strict })
    expect(mounted.result.current.history).toHaveLength(1)
    expect(mounted.result.current.history[0].id).toBe(now - 5_000)
    mounted.unmount()
    mounted = renderHook(usePomodoro, { wrapper: strict })
    expect(mounted.result.current.history).toHaveLength(1)
    expect(mounted.result.current.isRunning).toBe(false)
  })

  it('pauses using the clock even if the last screen tick is stale, then resumes', () => {
    restore({ deadline: now + 60_000 })
    const { result } = renderHook(usePomodoro)
    act(() => { vi.setSystemTime(now + 10_000); result.current.pause() })
    expect(result.current.timeLeft).toBe(50)
    expect(cancelAlarm).toHaveBeenCalled()
    act(() => { vi.setSystemTime(now + 20_000); result.current.start() })
    expect(JSON.parse(localStorage.getItem('pomo_session')).deadline).toBe(now + 70_000)
  })

  it('updates native notification sound without moving the deadline', () => {
    restore({ deadline: now + 60_000 })
    const { result } = renderHook(usePomodoro)
    act(() => { vi.setSystemTime(now + 10_000); result.current.setSoundEnabled(true) })
    expect(scheduleAlarm).toHaveBeenLastCalledWith(now + 60_000, 'work', true)
  })

  it('queues a long break after the fourth focus session', () => {
    restore({ deadline: now - 1, workCount: 3, sessionNum: 4 })
    const { result } = renderHook(usePomodoro)
    expect(result.current.workCount).toBe(4)
    expect(result.current.sessionType).toBe('longBreak')
    expect(result.current.timeLeft).toBe(15 * 60)
  })
})

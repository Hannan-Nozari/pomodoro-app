import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  checkPermissions: vi.fn(), requestPermissions: vi.fn(),
  cancel: vi.fn(), schedule: vi.fn(), createChannel: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: native }))

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  native.checkPermissions.mockResolvedValue({ display: 'granted' })
  native.requestPermissions.mockResolvedValue({ display: 'granted' })
  native.cancel.mockResolvedValue({})
  native.schedule.mockResolvedValue({})
  native.createChannel.mockResolvedValue({})
})

describe('native alarm ordering', () => {
  it('does not schedule a paused session after a delayed permission grant', async () => {
    const grant = deferred()
    native.checkPermissions.mockResolvedValue({ display: 'prompt' })
    native.requestPermissions.mockReturnValue(grant.promise)
    const { scheduleAlarm, cancelAlarm } = await import('./alarm')
    const pending = scheduleAlarm(Date.now() + 60_000, 'work')
    await vi.waitFor(() => expect(native.requestPermissions).toHaveBeenCalled())
    await cancelAlarm()
    grant.resolve({ display: 'granted' })
    await pending
    expect(native.schedule).not.toHaveBeenCalled()
  })

  it('does not schedule when Pause arrives during native cancellation', async () => {
    const cleared = deferred()
    native.cancel.mockReturnValueOnce(cleared.promise)
    const { scheduleAlarm, cancelAlarm } = await import('./alarm')
    const pending = scheduleAlarm(Date.now() + 60_000, 'work')
    await vi.waitFor(() => expect(native.cancel).toHaveBeenCalled())
    const paused = cancelAlarm()
    cleared.resolve({})
    await Promise.all([pending, paused])
    expect(native.schedule).not.toHaveBeenCalled()
  })

  it('cancels after an already submitted native schedule completes', async () => {
    const scheduled = deferred()
    native.schedule.mockReturnValueOnce(scheduled.promise)
    const { scheduleAlarm, cancelAlarm } = await import('./alarm')
    const pending = scheduleAlarm(Date.now() + 60_000, 'work')
    await vi.waitFor(() => expect(native.schedule).toHaveBeenCalled())
    const paused = cancelAlarm()
    scheduled.resolve({})
    await Promise.all([pending, paused])
    expect(native.cancel).toHaveBeenCalledTimes(2)
    expect(native.cancel.mock.invocationCallOrder[1]).toBeGreaterThan(native.schedule.mock.invocationCallOrder[0])
  })

  it('uses a silent Android channel when sound is disabled', async () => {
    const { scheduleAlarm } = await import('./alarm')
    await scheduleAlarm(Date.now() + 60_000, 'shortBreak', false)
    expect(native.createChannel).toHaveBeenCalledWith(expect.objectContaining({
      id: 'session-silent', importance: 2,
    }))
    expect(native.schedule).toHaveBeenCalledWith({ notifications: [expect.objectContaining({
      channelId: 'session-silent', sound: null, title: 'Break over',
    })] })
  })

  it('rechecks notification access after a previous grant is revoked', async () => {
    const { scheduleAlarm } = await import('./alarm')
    await scheduleAlarm(Date.now() + 60_000, 'work')
    native.checkPermissions.mockResolvedValue({ display: 'denied' })
    await scheduleAlarm(Date.now() + 60_000, 'work')
    expect(native.schedule).toHaveBeenCalledTimes(1)
    expect(native.checkPermissions).toHaveBeenCalledTimes(2)
  })
})

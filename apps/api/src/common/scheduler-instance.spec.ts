import { isSchedulerInstance } from './scheduler-instance.util'

describe('isSchedulerInstance', () => {
  const original = { ...process.env }

  afterEach(() => {
    process.env = { ...original }
  })

  it('is the scheduler when running as a single process', () => {
    delete process.env['NODE_APP_INSTANCE']
    delete process.env['pm_id']
    expect(isSchedulerInstance()).toBe(true)
  })

  it('is the scheduler on PM2 cluster worker 0', () => {
    process.env['NODE_APP_INSTANCE'] = '0'
    expect(isSchedulerInstance()).toBe(true)
  })

  it('skips scheduled work on every other cluster worker', () => {
    process.env['NODE_APP_INSTANCE'] = '1'
    expect(isSchedulerInstance()).toBe(false)
    process.env['NODE_APP_INSTANCE'] = '3'
    expect(isSchedulerInstance()).toBe(false)
  })

  it('falls back to pm_id when NODE_APP_INSTANCE is absent', () => {
    delete process.env['NODE_APP_INSTANCE']
    process.env['pm_id'] = '2'
    expect(isSchedulerInstance()).toBe(false)
    process.env['pm_id'] = '0'
    expect(isSchedulerInstance()).toBe(true)
  })

  it('treats a blank value as single-process rather than disabling the schedule', () => {
    process.env['NODE_APP_INSTANCE'] = '   '
    expect(isSchedulerInstance()).toBe(true)
  })
})

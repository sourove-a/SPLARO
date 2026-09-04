import { MediaJanitorCron } from './media-janitor.cron'

/**
 * The janitor deletes files, so the tests that matter are the ones proving it
 * refuses to: fresh uploads, trash inside its retention window, and anything a
 * usage check still claims.
 */

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function buildCron(options: {
  trashedAgeDays?: number
  orphanAgeHours?: number
  purgeSafe?: boolean
  removeThrows?: boolean
}) {
  const trashedAt = new Date(Date.now() - (options.trashedAgeDays ?? 60) * DAY)
  const modifiedAt = new Date(Date.now() - (options.orphanAgeHours ?? 48) * HOUR)

  const prisma = {
    store: { findMany: jest.fn().mockResolvedValue([{ id: 'store-1' }]) },
    mediaAsset: {
      findMany: jest.fn(({ where }: { where: { deletedAt?: { lt?: Date } } }) => {
        const cutoff = where.deletedAt?.lt
        if (cutoff && trashedAt >= cutoff) return Promise.resolve([])
        return Promise.resolve([{ id: 'asset-1', path: '/uploads/media/old.webp' }])
      }),
    },
  }

  const media = {
    remove: jest.fn(async () => {
      if (options.removeThrows) throw new Error('Media asset is still linked.')
      return { deleted: true }
    }),
    orphans: jest.fn().mockResolvedValue({
      available: true,
      orphans: [
        {
          familyKey: '/uploads/media/abandoned',
          path: '/uploads/media/abandoned.webp',
          paths: ['/uploads/media/abandoned.webp'],
          bytes: 1024 * 1024,
          files: 9,
          modifiedAt: modifiedAt.toISOString(),
          pending: false,
          purgeSafe: options.purgeSafe ?? true,
        },
      ],
    }),
    purgeOrphans: jest.fn().mockResolvedValue({
      deleted: 1,
      results: [{ path: '/uploads/media/abandoned.webp', ok: true }],
    }),
  }

  return { cron: new MediaJanitorCron(prisma as never, media as never), prisma, media }
}

describe('MediaJanitorCron', () => {
  const previousEnv = { ...process.env }

  beforeEach(() => {
    process.env.SCHEDULER_INSTANCE = '1'
    delete process.env.MEDIA_JANITOR
    delete process.env.MEDIA_TRASH_RETENTION_DAYS
    delete process.env.MEDIA_ORPHAN_GRACE_HOURS
  })

  afterEach(() => {
    process.env = { ...previousEnv }
  })

  it('purges trash past retention and unreferenced families past their grace window', async () => {
    const { cron, media } = buildCron({ trashedAgeDays: 60, orphanAgeHours: 48 })
    await cron.sweep()

    expect(media.remove).toHaveBeenCalledWith('store-1', 'asset-1', { permanent: true })
    expect(media.purgeOrphans).toHaveBeenCalledWith('store-1', ['/uploads/media/abandoned.webp'])
  })

  it('leaves an unreferenced family alone until it has settled', async () => {
    const { cron, media } = buildCron({ orphanAgeHours: 2 })
    await cron.sweep()

    expect(media.purgeOrphans).not.toHaveBeenCalled()
  })

  it('never touches a family the scan still calls unsafe to purge', async () => {
    const { cron, media } = buildCron({ orphanAgeHours: 48, purgeSafe: false })
    await cron.sweep()

    expect(media.purgeOrphans).not.toHaveBeenCalled()
  })

  it('keeps a trashed asset that turns out to be linked again', async () => {
    const { cron, media } = buildCron({ removeThrows: true })
    await expect(cron.sweep()).resolves.toBeUndefined()

    expect(media.remove).toHaveBeenCalled()
    // A throw from remove must not stop the rest of the sweep.
    expect(media.purgeOrphans).toHaveBeenCalled()
  })

  it('does nothing at all when MEDIA_JANITOR=0', async () => {
    process.env.MEDIA_JANITOR = '0'
    const { cron, media, prisma } = buildCron({})
    await cron.sweep()

    expect(prisma.store.findMany).not.toHaveBeenCalled()
    expect(media.remove).not.toHaveBeenCalled()
    expect(media.purgeOrphans).not.toHaveBeenCalled()
  })
})

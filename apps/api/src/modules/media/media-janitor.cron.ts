import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { isSchedulerInstance } from '../../common/scheduler-instance.util'
import { MediaService } from './media.service'

/**
 * Keep deleted media actually deleted.
 *
 * Two ways bytes were staying on the volume after nobody wanted them any more.
 * Deleting an asset moves it to trash and leaves the file where it is, and
 * nothing ever emptied that trash — so "deleted" only meant hidden. And an
 * upload writes its file plus the whole sized ladder to disk before the record
 * that owns it exists, so an operator who closes the dialog leaves eight or
 * nine files nothing points at. Measured on production: 22 such families,
 * 81 files, 15.2 MB, the oldest from three weeks earlier.
 *
 * Both sweeps are deliberately slow to act. Trash is a safety net and is only
 * emptied after the retention window; an unreferenced family is only removed
 * once it has sat still long enough that it cannot be an upload in flight, and
 * every delete still runs the same usage check the manual purge does.
 *
 * MEDIA_JANITOR=0 turns the sweep off. MEDIA_TRASH_RETENTION_DAYS and
 * MEDIA_ORPHAN_GRACE_HOURS move the two windows.
 */
@Injectable()
export class MediaJanitorCron {
  private readonly logger = new Logger(MediaJanitorCron.name)
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  private get enabled(): boolean {
    const flag = process.env.MEDIA_JANITOR?.trim().toLowerCase()
    return flag !== '0' && flag !== 'false'
  }

  private get trashRetentionMs(): number {
    const days = Number(process.env.MEDIA_TRASH_RETENTION_DAYS)
    return (Number.isFinite(days) && days > 0 ? days : 30) * 24 * 60 * 60 * 1000
  }

  private get orphanGraceMs(): number {
    const hours = Number(process.env.MEDIA_ORPHAN_GRACE_HOURS)
    return (Number.isFinite(hours) && hours > 0 ? hours : 24) * 60 * 60 * 1000
  }

  /** Overnight in Dhaka — the volume is quiet and nobody is mid-upload. */
  @Cron('35 3 * * *', { timeZone: 'Asia/Dhaka' })
  async sweep() {
    if (!isSchedulerInstance()) return
    if (!this.enabled) return
    if (this.running) return
    this.running = true

    try {
      const stores = await this.prisma.store.findMany({ select: { id: true } })
      let trashed = 0
      let orphaned = 0
      let bytes = 0

      for (const store of stores) {
        trashed += await this.emptyExpiredTrash(store.id)
        const swept = await this.sweepSettledOrphans(store.id)
        orphaned += swept.families
        bytes += swept.bytes
      }

      if (trashed || orphaned) {
        this.logger.log(
          `Media janitor: ${trashed} trashed asset(s) purged, ${orphaned} unreferenced ` +
            `famil(ies) removed, ${(bytes / 1048576).toFixed(2)}MB reclaimed`,
        )
      }
    } catch (error) {
      this.logger.error(`Media janitor failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.running = false
    }
  }

  /** Trash past its retention window — the record and the file both go. */
  private async emptyExpiredTrash(storeId: string): Promise<number> {
    const cutoff = new Date(Date.now() - this.trashRetentionMs)
    const expired = await this.prisma.mediaAsset.findMany({
      where: { storeId, deletedAt: { not: null, lt: cutoff } },
      select: { id: true, path: true },
      take: 200,
    })

    let purged = 0
    for (const asset of expired) {
      try {
        // permanent: true takes the same path as emptying the trash by hand,
        // usage check included — a file that got linked again is kept.
        await this.media.remove(storeId, asset.id, { permanent: true })
        purged += 1
      } catch (error) {
        this.logger.warn(
          `Kept trashed asset ${asset.path}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    return purged
  }

  /** Files on disk that no record points at, once they have stopped changing. */
  private async sweepSettledOrphans(storeId: string): Promise<{ families: number; bytes: number }> {
    const cutoff = Date.now() - this.orphanGraceMs
    const report = await this.media.orphans(storeId, { refresh: true, limit: 200 })
    if (!report.available) return { families: 0, bytes: 0 }

    const stale = report.orphans.filter(
      (family) => family.purgeSafe && new Date(family.modifiedAt).getTime() < cutoff,
    )
    if (!stale.length) return { families: 0, bytes: 0 }

    // purgeOrphans runs the usage check per family and caps its own batch size.
    const result = await this.media.purgeOrphans(
      storeId,
      stale.map((family) => family.path),
    )
    const deletedPaths = new Set(result.results.filter((row) => row.ok).map((row) => row.path))
    const bytes = stale
      .filter((family) => deletedPaths.has(family.path))
      .reduce((sum, family) => sum + family.bytes, 0)

    return { families: result.deleted, bytes }
  }
}

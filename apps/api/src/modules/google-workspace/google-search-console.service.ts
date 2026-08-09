import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { google } from 'googleapis'
import { resolveCustomerFacingSiteUrl, resolvePublicSiteUrl } from '@splaro/config'
import { CacheService } from '../../common/cache.service'
import { PrismaService } from '../../common/prisma.service'
import { RedisService } from '../../common/redis.service'
import { resolveStoreId } from '../../common/store.util'
import { GoogleClientService } from './google-client.service'
import {
  assertSplaroInspectUrl,
  buildGscInsights,
  classifyGscError,
  gscDateWindow,
  hasWebmastersReadonlyScope,
  knownStorefrontSitemaps,
  normalizeGscRow,
  parseGscRange,
  parseGscSort,
  pickSearchConsoleProperty,
  productSlugFromPageUrl,
  sortGscRows,
  type GscErrorCategory,
  type GscInsight,
  type GscRangeId,
  type GscRow,
  type GscSortKey,
  type GscStatusCode,
} from './google-search-console.util'

const PERFORMANCE_TTL_SEC = 30 * 60
const STATUS_TTL_SEC = 15 * 60
const INSPECT_LIMIT_PER_HOUR = 20
const INSPECT_WINDOW_SEC = 60 * 60

export type GscConnectionStatus = {
  connected: boolean
  status: GscStatusCode
  message: string
  property: string | null
  permission: string | null
  googleEmail: string | null
  lastSuccessAt: string | null
  lastError: string | null
  errorCategory: GscErrorCategory | null
  needsReconnect: boolean
}

@Injectable()
export class GoogleSearchConsoleService {
  private readonly logger = new Logger(GoogleSearchConsoleService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GoogleClientService,
    private readonly cache: CacheService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async getStatus(storeIdRaw: string): Promise<GscConnectionStatus> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    return this.cache.getOrSet(this.cache.storeKey(storeId, 'gsc', 'status'), STATUS_TTL_SEC, () =>
      this.loadStatus(storeId),
    )
  }

  async getPerformance(storeIdRaw: string, rangeRaw?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const range = parseGscRange(rangeRaw)
    return this.cache.getOrSet(
      this.cache.storeKey(storeId, 'gsc', `performance:${range}`),
      PERFORMANCE_TTL_SEC,
      () => this.loadPerformance(storeId, range),
    )
  }

  async getQueries(storeIdRaw: string, rangeRaw?: string, limitRaw?: string, sortRaw?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const range = parseGscRange(rangeRaw)
    const sort = parseGscSort(sortRaw)
    const limit = clampLimit(limitRaw, 25)
    return this.cache.getOrSet(
      this.cache.storeKey(storeId, 'gsc', `queries:${range}:${limit}:${sort}`),
      PERFORMANCE_TTL_SEC,
      () => this.loadDimensionRows(storeId, range, 'query', limit, sort),
    )
  }

  async getPages(storeIdRaw: string, rangeRaw?: string, limitRaw?: string, sortRaw?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const range = parseGscRange(rangeRaw)
    const sort = parseGscSort(sortRaw)
    const limit = clampLimit(limitRaw, 25)
    return this.cache.getOrSet(
      this.cache.storeKey(storeId, 'gsc', `pages:${range}:${limit}:${sort}`),
      PERFORMANCE_TTL_SEC,
      () => this.loadPages(storeId, range, limit, sort),
    )
  }

  async getSitemaps(storeIdRaw: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    return this.cache.getOrSet(this.cache.storeKey(storeId, 'gsc', 'sitemaps'), STATUS_TTL_SEC, () =>
      this.loadSitemaps(storeId),
    )
  }

  async getInsights(storeIdRaw: string, rangeRaw?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const range = parseGscRange(rangeRaw)
    return this.cache.getOrSet(
      this.cache.storeKey(storeId, 'gsc', `insights:${range}`),
      PERFORMANCE_TTL_SEC,
      () => this.loadInsights(storeId, range),
    )
  }

  async inspectUrl(storeIdRaw: string, rawUrl: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const allowed = assertSplaroInspectUrl(rawUrl, resolvePublicSiteUrl())
    if (!allowed.ok) throw new BadRequestException(allowed.reason)

    const count = await this.redis.incrWithExpiry(
      this.cache.storeKey(storeId, 'gsc', 'inspect-hour'),
      INSPECT_WINDOW_SEC,
    )
    if (count > INSPECT_LIMIT_PER_HOUR) {
      throw new HttpException(
        'URL inspection limit reached for this hour. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const ready = await this.requireConnected(storeId)
    try {
      const sc = await this.searchConsoleClient(storeId)
      const result = await sc.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl: allowed.url,
          siteUrl: ready.property,
        },
      })
      const inspection = result.data.inspectionResult ?? {}
      const indexStatus = inspection.indexStatusResult ?? {}
      this.logger.log(`Search Console URL inspection ok store=${storeId}`)
      return {
        url: allowed.url,
        property: ready.property,
        coverageState: indexStatus.coverageState ?? null,
        indexingState: indexStatus.indexingState ?? null,
        lastCrawlTime: indexStatus.lastCrawlTime ?? null,
        crawledAs: indexStatus.crawledAs ?? null,
        googleCanonical: indexStatus.googleCanonical ?? null,
        userCanonical: indexStatus.userCanonical ?? null,
        robotsTxtState: indexStatus.robotsTxtState ?? null,
        pageFetchState: indexStatus.pageFetchState ?? null,
        verdict: inspection.inspectionResultLink ? 'see_search_console' : null,
        inspectionResultLink: inspection.inspectionResultLink ?? null,
      }
    } catch (error) {
      throw this.wrapGoogleError(storeId, error, 'inspect')
    }
  }

  async refresh(storeIdRaw: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    await this.cache.invalidateStoreResource(storeId, 'gsc')
    this.logger.log(`Search Console cache cleared store=${storeId}`)
    return this.getStatus(storeId)
  }

  private async loadStatus(storeId: string): Promise<GscConnectionStatus> {
    const authState = await this.readAuthState(storeId)
    if (!authState.oauthConnected) {
      return this.disconnected(
        storeId,
        'not_connected',
        'Google ranking and crawl data unavailable until Search Console OAuth is connected.',
        authState.googleEmail,
      )
    }
    if (!authState.hasScope) {
      return this.disconnected(
        storeId,
        'needs_reconnect',
        'Reconnect Google Workspace to grant read-only Search Console access.',
        authState.googleEmail,
      )
    }

    try {
      const sc = await this.searchConsoleClient(storeId)
      const listed = await sc.sites.list()
      const picked = pickSearchConsoleProperty(
        listed.data.siteEntry ?? [],
        this.config.get<string>('GOOGLE_SEARCH_CONSOLE_PROPERTY'),
      )
      if (!picked) {
        this.logger.warn(`Search Console property missing store=${storeId}`)
        return this.disconnected(
          storeId,
          'missing_property',
          'This Google account has no verified splaro.co Search Console property.',
          authState.googleEmail,
        )
      }
      const lastSuccessAt = new Date().toISOString()
      this.logger.log(`Search Console connected store=${storeId}`)
      return {
        connected: true,
        status: 'connected',
        message: `Connected to ${picked.property}`,
        property: picked.property,
        permission: normalizePermission(picked.permission),
        googleEmail: authState.googleEmail,
        lastSuccessAt,
        lastError: null,
        errorCategory: null,
        needsReconnect: false,
      }
    } catch (error) {
      const classified = classifyGscError(error)
      this.logger.warn(`Search Console status failed store=${storeId} category=${classified.category}`)
      return this.disconnected(
        storeId,
        classified.category === 'needs_reconnect'
          ? 'needs_reconnect'
          : classified.category === 'quota'
            ? 'quota'
            : classified.category === 'missing_property'
              ? 'missing_property'
              : 'error',
        classified.message,
        authState.googleEmail,
        classified.category,
      )
    }
  }

  private async loadPerformance(storeId: string, range: GscRangeId) {
    const ready = await this.requireConnected(storeId)
    const window = gscDateWindow(range)
    try {
      const [current, previous] = await Promise.all([
        this.queryAnalytics(storeId, ready.property, window.startDate, window.endDate, ['date'], 400),
        this.queryAnalytics(storeId, ready.property, window.previousStart, window.previousEnd, ['date'], 400),
      ])
      const totals = sumRows(current)
      const previousTotals = sumRows(previous)
      return {
        range,
        ...window,
        currencyNote: 'Search Console traffic metrics are counts, not BDT.',
        totals,
        previous: previousTotals,
        delta: {
          clicks: totals.clicks - previousTotals.clicks,
          impressions: totals.impressions - previousTotals.impressions,
          ctr: totals.ctr - previousTotals.ctr,
          position: totals.position - previousTotals.position,
        },
        trend: current
          .map((row) => ({
            date: row.keys[0] ?? '',
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        property: ready.property,
        lastSuccessAt: new Date().toISOString(),
      }
    } catch (error) {
      throw this.wrapGoogleError(storeId, error, 'performance')
    }
  }

  private async loadDimensionRows(
    storeId: string,
    range: GscRangeId,
    dimension: 'query' | 'page',
    limit: number,
    sort: GscSortKey,
  ) {
    const ready = await this.requireConnected(storeId)
    const window = gscDateWindow(range)
    try {
      const rows = sortGscRows(
        await this.queryAnalytics(storeId, ready.property, window.startDate, window.endDate, [dimension], Math.max(limit, 50)),
        sort,
      ).slice(0, limit)
      return {
        range,
        ...window,
        sort,
        property: ready.property,
        rows: rows.map((row) => ({
          key: row.keys[0] ?? '',
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        })),
      }
    } catch (error) {
      throw this.wrapGoogleError(storeId, error, dimension)
    }
  }

  private async loadPages(storeId: string, range: GscRangeId, limit: number, sort: GscSortKey) {
    const payload = await this.loadDimensionRows(storeId, range, 'page', limit, sort)
    const slugs = payload.rows
      .map((row) => productSlugFromPageUrl(row.key))
      .filter((slug): slug is string => Boolean(slug))
    const products =
      slugs.length === 0
        ? []
        : await this.prisma.product.findMany({
            where: { storeId, slug: { in: slugs } },
            select: { slug: true, name: true },
          })
    const names = new Map(products.map((product) => [product.slug, product.name]))
    return {
      ...payload,
      rows: payload.rows.map((row) => {
        const slug = productSlugFromPageUrl(row.key)
        return {
          ...row,
          page: row.key,
          slug,
          name: slug ? names.get(slug) ?? null : null,
        }
      }),
    }
  }

  private async loadSitemaps(storeId: string) {
    const ready = await this.requireConnected(storeId)
    const origin = resolveCustomerFacingSiteUrl()
    const known = knownStorefrontSitemaps(origin)
    try {
      const sc = await this.searchConsoleClient(storeId)
      const listed = await sc.sitemaps.list({ siteUrl: ready.property })
      const googleSitemaps = (listed.data.sitemap ?? []).map((entry) => ({
        path: entry.path ?? null,
        lastSubmitted: entry.lastSubmitted ?? null,
        lastDownloaded: entry.lastDownloaded ?? null,
        isPending: Boolean(entry.isPending),
        isSitemapsIndex: Boolean(entry.isSitemapsIndex),
        warnings: Number(entry.warnings ?? 0),
        errors: Number(entry.errors ?? 0),
      }))
      return {
        property: ready.property,
        known,
        submitSupported: false,
        submitMessage:
          'Sitemap submit is not available on the read-only Search Console scope. Submit once in Google Search Console, or reconnect later with write access.',
        google: googleSitemaps,
        lastSuccessAt: new Date().toISOString(),
      }
    } catch (error) {
      throw this.wrapGoogleError(storeId, error, 'sitemaps')
    }
  }

  private async loadInsights(storeId: string, range: GscRangeId): Promise<{
    range: GscRangeId
    insights: GscInsight[]
    property: string
  }> {
    const ready = await this.requireConnected(storeId)
    const window = gscDateWindow(range)
    try {
      const [queries, pages, previousPages] = await Promise.all([
        this.queryAnalytics(storeId, ready.property, window.startDate, window.endDate, ['query'], 50),
        this.queryAnalytics(storeId, ready.property, window.startDate, window.endDate, ['page'], 50),
        this.queryAnalytics(storeId, ready.property, window.previousStart, window.previousEnd, ['page'], 50),
      ])
      return {
        range,
        property: ready.property,
        insights: buildGscInsights({ queries, pages, previousPages }),
      }
    } catch (error) {
      throw this.wrapGoogleError(storeId, error, 'insights')
    }
  }

  private async queryAnalytics(
    storeId: string,
    property: string,
    startDate: string,
    endDate: string,
    dimensions: string[],
    rowLimit: number,
  ): Promise<GscRow[]> {
    const sc = await this.searchConsoleClient(storeId)
    const result = await sc.searchanalytics.query({
      siteUrl: property,
      requestBody: {
        startDate,
        endDate,
        dimensions,
        rowLimit,
        startRow: 0,
      },
    })
    return (result.data.rows ?? []).map((row) => normalizeGscRow(row))
  }

  private async searchConsoleClient(storeId: string) {
    const auth = await this.client.getAuthenticatedClient(storeId)
    return google.searchconsole({ version: 'v1', auth })
  }

  private async requireConnected(storeId: string): Promise<{ property: string } & GscConnectionStatus> {
    const status = await this.getStatus(storeId)
    if (!status.connected || !status.property) {
      throw new BadRequestException(status.message)
    }
    return { ...status, property: status.property }
  }

  private async readAuthState(storeId: string) {
    const conn = await this.prisma.googleWorkspaceConnection.findUnique({ where: { storeId } })
    const token = conn
      ? await this.prisma.googleWorkspaceToken.findUnique({
          where: { connectionId_serviceName: { connectionId: conn.id, serviceName: 'oauth' } },
          select: { refreshTokenEncrypted: true, scope: true },
        })
      : null
    return {
      oauthConnected: Boolean(token?.refreshTokenEncrypted),
      hasScope: hasWebmastersReadonlyScope(token?.scope, conn?.scopes),
      googleEmail: conn?.googleEmail ?? null,
    }
  }

  private disconnected(
    _storeId: string,
    status: GscStatusCode,
    message: string,
    googleEmail: string | null,
    errorCategory: GscErrorCategory | null = status === 'connected' ? null : (status as GscErrorCategory),
  ): GscConnectionStatus {
    return {
      connected: false,
      status,
      message,
      property: null,
      permission: null,
      googleEmail,
      lastSuccessAt: null,
      lastError: status === 'not_connected' ? null : message,
      errorCategory: status === 'not_connected' ? null : errorCategory,
      needsReconnect: status === 'needs_reconnect',
    }
  }

  private wrapGoogleError(storeId: string, error: unknown, action: string): never {
    const classified = classifyGscError(error)
    this.logger.warn(`Search Console ${action} failed store=${storeId} category=${classified.category}`)
    if (classified.category === 'quota') {
      throw new HttpException(classified.message, HttpStatus.TOO_MANY_REQUESTS)
    }
    throw new BadRequestException(classified.message)
  }
}

function clampLimit(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(100, Math.max(1, Math.trunc(parsed)))
}

function sumRows(rows: GscRow[]): { clicks: number; impressions: number; ctr: number; position: number } {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0)
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0)
  const weightedPosition = rows.reduce((sum, row) => sum + row.position * row.impressions, 0)
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : 0,
  }
}

function normalizePermission(raw: string | null): string | null {
  if (!raw) return null
  const value = raw.toLowerCase()
  if (value.includes('owner')) return 'owner'
  if (value.includes('full')) return 'full'
  if (value.includes('restricted') || value.includes('unverified')) return 'restricted'
  return raw
}

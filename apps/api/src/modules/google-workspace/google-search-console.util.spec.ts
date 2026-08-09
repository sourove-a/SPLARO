import {
  assertSplaroInspectUrl,
  buildGscInsights,
  classifyGscError,
  dhakaYmd,
  gscDateWindow,
  hasWebmastersReadonlyScope,
  knownStorefrontSitemaps,
  normalizeGscRow,
  parseGscRange,
  parseGscSort,
  pickSearchConsoleProperty,
  productSlugFromPageUrl,
  sanitizeGscErrorMessage,
  sortGscRows,
} from './google-search-console.util'

describe('parseGscRange / sort', () => {
  it('defaults to 28d and clicks', () => {
    expect(parseGscRange(undefined)).toBe('28d')
    expect(parseGscRange('7d')).toBe('7d')
    expect(parseGscSort('ctr')).toBe('ctr')
    expect(parseGscSort('nope')).toBe('clicks')
  })
})

describe('gscDateWindow', () => {
  it('uses Asia/Dhaka dates with a 2-day GSC lag and previous period', () => {
    const window = gscDateWindow('7d', new Date('2026-08-10T08:00:00.000Z'))
    expect(window.days).toBe(7)
    expect(window.endDate).toBe('2026-08-08')
    expect(window.startDate).toBe('2026-08-02')
    expect(window.previousEnd).toBe('2026-08-01')
    expect(window.previousStart).toBe('2026-07-26')
    expect(dhakaYmd(new Date('2026-08-10T08:00:00.000Z'))).toBe('2026-08-10')
  })
})

describe('hasWebmastersReadonlyScope', () => {
  it('detects the readonly Search Console scope across blobs', () => {
    expect(hasWebmastersReadonlyScope('https://www.googleapis.com/auth/spreadsheets')).toBe(false)
    expect(
      hasWebmastersReadonlyScope(
        'openid email https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/gmail.send',
      ),
    ).toBe(true)
    expect(hasWebmastersReadonlyScope(null, 'WEBMASTERS.READONLY')).toBe(false)
    expect(
      hasWebmastersReadonlyScope(undefined, 'https://www.googleapis.com/auth/webmasters.readonly'),
    ).toBe(true)
  })
})

describe('assertSplaroInspectUrl', () => {
  it('allows https splaro.co product URLs', () => {
    const result = assertSplaroInspectUrl('https://splaro.co/products/linen-friday-panjabi')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.url).toContain('splaro.co/products/linen-friday-panjabi')
  })

  it('rejects other hosts and schemes', () => {
    expect(assertSplaroInspectUrl('https://evil.example/products/x').ok).toBe(false)
    expect(assertSplaroInspectUrl('javascript:alert(1)').ok).toBe(false)
    expect(assertSplaroInspectUrl('http://splaro.co/').ok).toBe(false)
    expect(assertSplaroInspectUrl('https://admin.splaro.co/dashboard').ok).toBe(false)
  })

  it('allows configured site origin and loopback http in local', () => {
    expect(assertSplaroInspectUrl('http://localhost:3000/products/x', 'http://localhost:3000').ok).toBe(true)
    expect(assertSplaroInspectUrl('https://www.splaro.co/shop').ok).toBe(true)
  })
})

describe('pickSearchConsoleProperty', () => {
  const sites = [
    { siteUrl: 'https://example.com/', permissionLevel: 'siteFullUser' },
    { siteUrl: 'https://splaro.co/', permissionLevel: 'siteOwner' },
    { siteUrl: 'sc-domain:splaro.co', permissionLevel: 'siteFullUser' },
  ]

  it('prefers env override, then domain property, then https root', () => {
    expect(pickSearchConsoleProperty(sites, 'https://splaro.co/')?.property).toBe('https://splaro.co/')
    expect(pickSearchConsoleProperty(sites)?.property).toBe('sc-domain:splaro.co')
    expect(pickSearchConsoleProperty([{ siteUrl: 'https://splaro.co/' }])?.property).toBe('https://splaro.co/')
    expect(pickSearchConsoleProperty([{ siteUrl: 'https://other.dev/' }])).toBeNull()
  })
})

describe('normalize + sort + slug', () => {
  it('computes CTR from clicks/impressions and sorts', () => {
    const rows = sortGscRows(
      [
        normalizeGscRow({ keys: ['b'], clicks: 2, impressions: 100, position: 12 }),
        normalizeGscRow({ keys: ['a'], clicks: 10, impressions: 20, position: 4 }),
      ],
      'clicks',
    )
    expect(rows[0]?.keys[0]).toBe('a')
    expect(rows[0]?.ctr).toBe(0.5)
    expect(productSlugFromPageUrl('https://splaro.co/products/premium-cotton-polo')).toBe('premium-cotton-polo')
    expect(productSlugFromPageUrl('https://splaro.co/shop')).toBeNull()
  })
})

describe('knownStorefrontSitemaps', () => {
  it('returns the live storefront sitemap URLs', () => {
    expect(knownStorefrontSitemaps('https://splaro.co')).toEqual([
      'https://splaro.co/sitemap.xml',
      'https://splaro.co/sitemap-images.xml',
    ])
  })
})

describe('buildGscInsights', () => {
  it('emits deterministic opportunity chips without fabricating when data is thin', () => {
    expect(buildGscInsights({ queries: [], pages: [] })).toEqual([])
    const insights = buildGscInsights({
      queries: [
        normalizeGscRow({ keys: ['linen panjabi'], clicks: 1, impressions: 400, position: 11 }),
        normalizeGscRow({ keys: ['rare'], clicks: 0, impressions: 3, position: 40 }),
      ],
      pages: [normalizeGscRow({ keys: ['https://splaro.co/products/x'], clicks: 4, impressions: 80, position: 9 })],
      previousPages: [
        normalizeGscRow({ keys: ['https://splaro.co/products/x'], clicks: 20, impressions: 80, position: 6 }),
      ],
    })
    expect(insights.some((row) => row.kind === 'high_impressions_low_ctr')).toBe(true)
    expect(insights.some((row) => row.kind === 'position_8_15')).toBe(true)
    expect(insights.some((row) => row.kind === 'clicks_down')).toBe(true)
  })
})

describe('classifyGscError', () => {
  it('maps quota / revoke / permission without leaking tokens', () => {
    expect(classifyGscError({ response: { status: 429 }, message: 'Quota exceeded' }).category).toBe('quota')
    expect(classifyGscError(new Error('invalid_grant')).category).toBe('needs_reconnect')
    expect(classifyGscError({ response: { status: 403 }, message: 'Caller does not have permission' }).category).toBe(
      'missing_property',
    )
    const leaked = sanitizeGscErrorMessage('Bearer ya29.secret refresh_token=1/abc client_secret=GOCSPX-x')
    expect(leaked).not.toContain('ya29')
    expect(leaked).not.toContain('GOCSPX')
    expect(leaked).not.toContain('1/abc')
  })
})

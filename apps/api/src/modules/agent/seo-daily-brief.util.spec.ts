import { buildSeoDailyBrief } from './seo-daily-brief.util'

describe('buildSeoDailyBrief', () => {
  it('targets the weakest product and labels onsite demand honestly', () => {
    const brief = buildSeoDailyBrief(
      [
        { id: 'ready', name: 'Ready Dress', slug: 'ready-dress', metaTitle: 'R'.repeat(35), metaDescription: 'D'.repeat(130) },
        { id: 'weak', name: 'Weak Panjabi', slug: 'weak-panjabi', metaTitle: null, metaDescription: null },
      ],
      [{ query: 'Panjabi' }, { query: ' panjabi ' }, { query: 'dress' }],
    )

    expect(brief.level).toBe('warn')
    expect(brief.body).toContain("Today's target: Weak Panjabi")
    expect(brief.body).toContain('Onsite demand: “panjabi” — 2 searches')
    expect(brief.body).toContain('Google ranking unavailable')
    expect(brief.body).toContain('No metadata changed automatically')
  })

  it('does not invent targets or ranking data for an empty catalog', () => {
    const brief = buildSeoDailyBrief([], [])

    expect(brief.level).toBe('info')
    expect(brief.body).toContain('publish a product')
    expect(brief.body).toContain('no customer search signal')
  })
})

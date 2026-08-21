import {
  ensureEssentialHeaderDepartments,
  mergeHeaderNav,
  mergeStorefrontConfig,
  PRIMARY_SMTP_ACCOUNT_ID,
  shouldHideEmptyNavNode,
  isAlwaysOnMenuDepartment,
  smtpPoolNeedsPrimarySync,
  displaySmtpAccounts,
  upsertPrimarySmtpAccount,
} from './storefront-config'

describe('storefront header navigation', () => {
  it('keeps admin order, removals, and visibility exactly', () => {
    const current = [
      {
        label: 'Kids',
        href: '/c/kids',
        megaMenu: { categories: [{ label: 'Fixture', href: '/fixture' }], heroes: [] },
      },
      { label: 'Shop', href: '/shop' },
    ]
    const incoming = [
      { label: 'Journal', href: '/editorial', hidden: true },
      { label: 'Shop all', href: '/shop' },
    ]

    expect(mergeHeaderNav(current, incoming)).toEqual(incoming)
  })

  it('does not restore removed default links while merging stored settings', () => {
    const config = mergeStorefrontConfig({
      headerNav: [{ label: 'Only shop', href: '/shop' }],
    })

    expect(config.headerNav).toEqual([{ label: 'Only shop', href: '/shop' }])
  })

  it('persists a custom homepage section order', () => {
    const config = mergeStorefrontConfig({
      homepage: {
        hero: true,
        order: ['catalog', 'hero', 'newsletter'],
      },
    })
    expect(config.homepage?.order?.[0]).toBe('catalog')
    expect(config.homepage?.order).toContain('marquee')
  })

  it('keeps saved global SEO meta title and description', () => {
    const config = mergeStorefrontConfig({
      seo: {
        metaTitle: 'SPLARO | Custom title',
        metaDescription: 'Custom description for search.',
      },
    })

    expect(config.seo).toEqual({
      metaTitle: 'SPLARO | Custom title',
      metaDescription: 'Custom description for search.',
      googleSiteVerification: '',
    })
  })

  it('heal-on-read re-injects Accessories after Footwear', () => {
    const healed = ensureEssentialHeaderDepartments([
      { label: 'Shop', href: '/shop' },
      { label: 'Men', href: '/collections/men' },
      { label: 'Footwear', href: '/collections/footwear' },
    ])
    const accessoriesIdx = healed.findIndex((l) => l.href === '/accessories')
    const footwearIdx = healed.findIndex((l) => /footwear/i.test(l.href) || l.label === 'Footwear')
    expect(accessoriesIdx).toBeGreaterThan(-1)
    expect(accessoriesIdx).toBe(footwearIdx + 1)
    expect(healed[accessoriesIdx]?.label).toBe('Accessories')
  })

  it('heal-on-read unhides Accessories and accepts /c/accessories alias', () => {
    const healed = ensureEssentialHeaderDepartments([
      { label: 'Shop', href: '/shop' },
      { label: 'Accessories', href: '/c/accessories', hidden: true },
    ])
    const acc = healed.find((l) => l.label === 'Accessories')
    expect(acc?.hidden).toBeUndefined()
    expect(acc?.href).toBe('/accessories')
  })
})

describe('primary SMTP delivery pool', () => {
  const smtp = {
    enabled: true,
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false,
    user: 'noreply@splaro.co',
    password: 'secret',
    fromName: 'SPLARO',
    fromEmail: 'noreply@splaro.co',
    replyTo: 'support@splaro.co',
  }

  it('does not persist a pool row without a password', () => {
    expect(upsertPrimarySmtpAccount({ ...smtp, password: '' }, [])).toEqual([])
    expect(smtpPoolNeedsPrimarySync({ ...smtp, password: '' }, [])).toBe(false)
  })

  it('shows the Notifications mailbox in the pool UI without a stored password', () => {
    const visible = displaySmtpAccounts({ ...smtp, password: '' }, [])
    expect(visible).toHaveLength(1)
    expect(visible[0]?.id).toBe(PRIMARY_SMTP_ACCOUNT_ID)
    expect(visible[0]?.user).toBe('noreply@splaro.co')
  })

  it('upserts smtp-primary from the Notifications mailbox', () => {
    const pool = upsertPrimarySmtpAccount(smtp, [])
    expect(pool).toHaveLength(1)
    expect(pool[0]?.id).toBe(PRIMARY_SMTP_ACCOUNT_ID)
    expect(pool[0]?.password).toBe('secret')
    expect(pool[0]?.priority).toBe(1)
    expect(smtpPoolNeedsPrimarySync(smtp, [])).toBe(true)
    expect(smtpPoolNeedsPrimarySync(smtp, pool)).toBe(false)
  })

  it('keeps extra failover accounts behind the primary', () => {
    const pool = upsertPrimarySmtpAccount(smtp, [
      {
        ...smtp,
        id: 'smtp-backup',
        label: 'backup',
        priority: 1,
        password: 'other',
        user: 'hello@splaro.co',
      },
    ])
    expect(pool.map((row) => row.id)).toEqual([PRIMARY_SMTP_ACCOUNT_ID, 'smtp-backup'])
    expect(pool[1]?.priority).toBe(2)
  })
})

describe('hideEmptyCategories', () => {
  it('defaults on when menuOverrides omit the flag', () => {
    const config = mergeStorefrontConfig({ menuOverrides: { autoSync: true, departments: [] } })
    expect(config.menuOverrides?.hideEmptyCategories).toBe(true)
  })

  it('hides empty departments unless force-visible', () => {
    expect(
      shouldHideEmptyNavNode({ hideEmptyCategories: true, forceVisible: false, productCount: 0 }),
    ).toBe(true)
    expect(
      shouldHideEmptyNavNode({ hideEmptyCategories: true, forceVisible: true, productCount: 0 }),
    ).toBe(false)
    expect(
      shouldHideEmptyNavNode({ hideEmptyCategories: false, productCount: 0 }),
    ).toBe(false)
  })

  it('keeps the five storefront departments on-menu when empty', () => {
    for (const slug of ['women', 'men', 'kids', 'footwear', 'accessories'] as const) {
      expect(isAlwaysOnMenuDepartment(slug)).toBe(true)
      expect(
        shouldHideEmptyNavNode({
          hideEmptyCategories: true,
          forceVisible: isAlwaysOnMenuDepartment(slug),
          productCount: 0,
        }),
      ).toBe(false)
    }
    expect(isAlwaysOnMenuDepartment('new-arrivals')).toBe(false)
    expect(
      shouldHideEmptyNavNode({ hideEmptyCategories: true, forceVisible: false, productCount: 0 }),
    ).toBe(true)
  })
})

'use client'

import { Fragment, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { toastInfo } from '@/lib/admin/feedback'
import {
  BookOpen,
  ChevronDown,
  Eye,
  ExternalLink,
  FileEdit,
  GripVertical,
  Home,
  LayoutTemplate,
  Newspaper,
  Palette,
  Pencil,
  Video,
} from 'lucide-react'
import { AdminLinkButton } from '@/components/ui/AdminButton'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { ModulePanelShell, STATUS_CLASS } from '@/components/modules/ModulePanelShell'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { cn } from '@/lib/utils/cn'
import { SPLARO_DOMAINS } from '@splaro/config'
import { useContentOverview, useCreateBlogPost, useBanners, useSettings, useSitePages, useCreateSitePage, useUpdateSitePage, useDeleteSitePage, useCreateCollection } from '@/lib/api/hooks'
import type { SitePageRow } from '@/lib/api/content-pages'
import { formatRelativeTime } from '@/lib/api/orders'
import { resolveMediaUrl } from '@/lib/media-url'

type PubStatus = 'published' | 'draft' | 'scheduled' | 'archived'

function landingBodyFromContent(page: SitePageRow): string {
  if (!page.content) return ''
  try {
    const parsed = JSON.parse(page.content) as { sections?: { body?: string }[]; description?: string }
    if (parsed.sections?.[0]?.body) return parsed.sections[0].body
    if (parsed.description) return parsed.description
  } catch {
    return page.content
  }
  return ''
}

function buildLandingContent(title: string, body: string) {
  const trimmed = body.trim()
  return JSON.stringify({
    title,
    description: trimmed.slice(0, 160),
    sections: [{ heading: title, body: trimmed || '(Add landing page content)' }],
  })
}

function mapBlogStatus(status: string): PubStatus {
  if (status === 'PUBLISHED') return 'published'
  if (status === 'SCHEDULED') return 'scheduled'
  return 'draft'
}

export function BlogPanelLive() {
  const { data, isError, isLoading, refetch } = useContentOverview()
  const createPost = useCreateBlogPost()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PubStatus | 'all'>('all')
  const posts = useMemo(() => data?.posts ?? [], [data])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return posts.filter((p) => {
      const st = mapBlogStatus(p.status)
      const matchQ = !q || p.title.toLowerCase().includes(q)
      const matchS = statusFilter === 'all' || st === statusFilter
      return matchQ && matchS
    })
  }, [query, statusFilter, posts])

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'published', label: 'Published' },
    { key: 'draft', label: 'Draft' },
    { key: 'scheduled', label: 'Scheduled' },
  ] as const

  const handleCreate = () => {
    const title = window.prompt('Post title')
    if (!title?.trim()) return
    createPost.mutate(
      { title: title.trim(), status: 'DRAFT' },
      {
        onSuccess: () => toast.success('Blog post created.'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  if (isError) return <ApiOfflineBanner message="Content API offline — start pnpm dev:api." />

  return (
    <ModulePanelShell
      kpis={[
        ['Posts', isLoading ? '…' : posts.length, 'default'],
        ['Published', posts.filter((p) => p.status === 'PUBLISHED').length, 'success'],
        ['Views', posts.reduce((s, p) => s + p.viewCount, 0).toLocaleString('en-BD'), 'gold'],
        ['Draft', posts.filter((p) => p.status === 'DRAFT').length, 'warning'],
      ]}
      pipeline={[
        ['Published', posts.filter((p) => p.status === 'PUBLISHED').length],
        ['Draft', posts.filter((p) => p.status === 'DRAFT').length],
        ['Categories', data?.categories.length ?? 0],
        ['Authors', '—'],
        ['API', 'Live'],
      ]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search post title..."
      createLabel="Write post"
      onCreate={handleCreate}
      onRefresh={() => void refetch()}
      exportDisabled
      tabs={tabs.map((t) => ({
        key: t.key,
        label: t.label,
        count: t.key === 'all' ? posts.length : posts.filter((p) => mapBlogStatus(p.status) === t.key).length,
      }))}
      activeTab={statusFilter}
      onTab={(k) => setStatusFilter(k as PubStatus | 'all')}
      tableIcon={Newspaper}
      tableTitle={`Blog · ${filtered.length} posts`}
      footer="Live from blog_post table"
    >
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--admin-text-muted)]">No blog posts yet — click Write post to create one.</p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Views</th>
              <th>Status</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="max-w-[200px] font-semibold">{p.title}</td>
                <td className="text-xs">{p.category?.name ?? '—'}</td>
                <td className="font-bold">{p.viewCount.toLocaleString()}</td>
                <td>
                  <span className={STATUS_CLASS[mapBlogStatus(p.status)]}>{mapBlogStatus(p.status)}</span>
                </td>
                <td className="muted text-xs">{formatRelativeTime(p.updatedAt)}</td>
                <td>
                  <RowActionsMenu recordName={p.title} moduleHref="/dashboard/blog" recordId={p.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
  )
}

export function LookbooksPanelLive() {
  const { data, isError, isLoading, refetch } = useContentOverview()
  const createCollection = useCreateCollection()
  const [query, setQuery] = useState('')
  const collections = useMemo(() => data?.collections ?? [], [data])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return collections.filter((c) => !q || c.name.toLowerCase().includes(q))
  }, [query, collections])

  const handleCreate = () => {
    const name = window.prompt('Lookbook / collection name')
    if (!name?.trim()) return
    createCollection.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          toast.success('Lookbook collection created.')
          void refetch()
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  if (isError) return <ApiOfflineBanner message="Content API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Lookbooks', isLoading ? '…' : collections.length, 'default'],
        ['Active', collections.filter((c) => c.isActive).length, 'success'],
        ['Products tagged', collections.reduce((s, c) => s + (c._count?.products ?? 0), 0), 'gold'],
        ['Draft', collections.filter((c) => !c.isActive).length, 'warning'],
      ]}
      pipeline={[['Active', collections.filter((c) => c.isActive).length], ['Products', collections.reduce((s, c) => s + (c._count?.products ?? 0), 0)], ['Live', 'API'], ['—', '—'], ['—', '—']]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search collection..."
      createLabel="New lookbook"
      onCreate={handleCreate}
      onRefresh={() => void refetch()}
      exportDisabled
      tableIcon={BookOpen}
      tableTitle={`Lookbooks · ${filtered.length}`}
      footer="Collections used as editorial lookbooks"
    >
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--admin-text-muted)]">No collections yet.</p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Products</th>
              <th>Status</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id}>
                <td className="font-semibold">{l.name}</td>
                <td className="font-mono text-xs">{l.slug}</td>
                <td>{l._count?.products ?? 0}</td>
                <td>
                  <span className={STATUS_CLASS[l.isActive ? 'published' : 'draft']}>
                    {l.isActive ? 'published' : 'draft'}
                  </span>
                </td>
                <td className="muted text-xs">{formatRelativeTime(l.updatedAt)}</td>
                <td>
                  <RowActionsMenu recordName={l.name} moduleHref="/dashboard/collections" recordId={l.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
  )
}

export function ReelsPanelLive() {
  const { data, isError, isLoading, refetch } = useContentOverview()
  const [query, setQuery] = useState('')
  const banners = useMemo(() => data?.banners ?? [], [data])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return banners.filter((b) => !q || (b.title ?? '').toLowerCase().includes(q))
  }, [query, banners])

  if (isError) return <ApiOfflineBanner message="Content API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Assets', isLoading ? '…' : banners.length, 'default'],
        ['Live', banners.filter((b) => b.isActive).length, 'success'],
        ['Hero', banners.filter((b) => b.position === 'hero').length, 'gold'],
        ['Hidden', banners.filter((b) => !b.isActive).length, 'warning'],
      ]}
      pipeline={[['Live', banners.filter((b) => b.isActive).length], ['Hero', banners.filter((b) => b.position === 'hero').length], ['API', 'OK'], ['—', '—'], ['—', '—']]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search banner..."
      createLabel="Upload reel"
      onCreate={() => toast('Upload video banners via Media Library.', { icon: '🎬' })}
      onRefresh={() => void refetch()}
      exportDisabled
      tableIcon={Video}
      tableTitle={`Reels & video · ${filtered.length}`}
      footer="Banner assets from database"
    >
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--admin-text-muted)]">No video/banner assets yet.</p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Preview</th>
              <th>Title</th>
              <th>Position</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <img src={resolveMediaUrl(r.image)} alt="" className="h-10 w-16 rounded-lg object-cover" />
                </td>
                <td className="font-semibold">{r.title ?? 'Untitled'}</td>
                <td className="text-xs">{r.position}</td>
                <td>
                  <span className={STATUS_CLASS[r.isActive ? 'published' : 'draft']}>
                    {r.isActive ? 'published' : 'draft'}
                  </span>
                </td>
                <td>
                  <RowActionsMenu recordName={r.title ?? r.id} moduleHref="/dashboard/reels" recordId={r.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
  )
}

export function CmsPanelLive() {
  const { data, isError, refetch } = useContentOverview()
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const pages = useMemo(() => {
    const staticP = (data?.staticPages ?? []).map((p) => ({
      id: `static-${p.id}`,
      title: p.title,
      slug: p.slug,
      blocks: p.blocks,
      status: 'published' as PubStatus,
      updated: p.updatedAt,
    }))
    const blogPages = (data?.posts ?? [])
      .filter((p) => p.status === 'PUBLISHED')
      .map((p) => ({
        id: `blog-${p.id}`,
        title: p.title,
        slug: `/blog/${p.slug}`,
        blocks: 1,
        status: mapBlogStatus(p.status),
        updated: p.updatedAt,
      }))
    return [...staticP, ...blogPages]
  }, [data])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return pages.filter((p) => !q || p.title.toLowerCase().includes(q) || p.slug.includes(q))
  }, [query, pages])

  if (isError) return <ApiOfflineBanner message="Content API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Pages', pages.length, 'default'],
        ['Published', pages.filter((p) => p.status === 'published').length, 'success'],
        ['Static', data?.staticPages.length ?? 0, 'gold'],
        ['Blog pages', data?.posts.filter((p) => p.status === 'PUBLISHED').length ?? 0, 'warning'],
      ]}
      pipeline={[['Static', data?.staticPages.length ?? 0], ['Blog', data?.posts.length ?? 0], ['Live', 'API'], ['—', '—'], ['—', '—']]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search page or slug..."
      createLabel="New page"
      onCreate={() => toast('Static pages are storefront routes — use Blog for new content.', { icon: '📄' })}
      onRefresh={() => void refetch()}
      exportDisabled
      tableIcon={FileEdit}
      tableTitle={`CMS pages · ${filtered.length}`}
      footer="Static storefront routes + published blog posts"
    >
      <table className="admin-module-table">
        <thead>
          <tr>
            <th>Page</th>
            <th>Slug</th>
            <th>Blocks</th>
            <th>Status</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <Fragment key={p.id}>
                <tr className={cn(expandedId === p.id && 'bg-[var(--admin-surface-hover)]')}>
                <td>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    className="flex items-center gap-1 font-semibold hover:text-[#5E7CFF]"
                  >
                    {p.title}
                    <ChevronDown className={cn('h-3 w-3 transition', expandedId === p.id && 'rotate-180')} />
                  </button>
                </td>
                <td className="font-mono text-xs">{p.slug}</td>
                <td>{p.blocks}</td>
                <td>
                  <span className={STATUS_CLASS[p.status]}>{p.status}</span>
                </td>
                <td className="muted text-xs">{formatRelativeTime(p.updated)}</td>
                <td>
                  <RowActionsMenu recordName={p.title} moduleHref="/dashboard/cms" recordId={p.id} />
                </td>
              </tr>
              {expandedId === p.id ? (
                <tr className="bg-[var(--admin-surface-hover)]">
                  <td colSpan={6} className="!py-3">
                    <div className="flex flex-wrap gap-2">
                      <AdminLinkButton href={`https://splaro.co${p.slug}`} external size="sm">
                        <Eye className="h-3.5 w-3.5" /> View live
                      </AdminLinkButton>
                      {p.id.startsWith('static-') ? (
                        <AdminLinkButton
                          href={`/dashboard/legal-pages?slug=${encodeURIComponent(p.slug.replace(/^\//, ''))}`}
                          variant="gold"
                          size="sm"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit in Legal Pages
                        </AdminLinkButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </ModulePanelShell>
  )
}

export function LandingPagesPanelLive() {
  const { data: pages = [], isError, isLoading, refetch } = useSitePages()
  const createPage = useCreateSitePage()
  const updatePage = useUpdateSitePage()
  const deletePage = useDeleteSitePage()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return pages.filter((p) => !q || p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
  }, [query, pages])

  const liveUrl = (slug: string) => `${SPLARO_DOMAINS.site.replace(/\/$/, '')}/lp/${slug}`

  const handleCreate = () => {
    const title = window.prompt('Landing page title (e.g. Eid Sale 2026)')
    if (!title?.trim()) return
    createPage.mutate(
      { title: title.trim(), isPublished: false },
      {
        onSuccess: (row) => toast.success(`Created /lp/${row.slug}`),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const togglePublish = (id: string, next: boolean, title: string) => {
    updatePage.mutate(
      { id, isPublished: next },
      {
        onSuccess: () => toast.success(next ? `"${title}" is live` : `"${title}" unpublished`),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const handleDelete = (id: string, title: string) => {
    if (!window.confirm(`Delete landing page "${title}"?`)) return
    deletePage.mutate(id, {
      onSuccess: () => toast.success('Landing page deleted.'),
      onError: (e) => toast.error(e.message),
    })
  }

  const handleEditContent = (page: SitePageRow) => {
    const current = landingBodyFromContent(page)
    const next = window.prompt(`Edit body for "${page.title}":`, current)
    if (next === null) return
    const content = buildLandingContent(page.title, next)
    updatePage.mutate(
      {
        id: page.id,
        content,
        metaDesc: next.trim().slice(0, 160) || page.title,
      },
      {
        onSuccess: () => toast.success('Landing page content saved.'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const handleRename = (page: SitePageRow) => {
    const next = window.prompt('Landing page title:', page.title)
    if (!next?.trim() || next.trim() === page.title) return
    const title = next.trim()
    const content = buildLandingContent(title, landingBodyFromContent(page))
    updatePage.mutate(
      { id: page.id, title, content, metaTitle: title },
      {
        onSuccess: () => toast.success('Title updated.'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  if (isError) return <ApiOfflineBanner message="Content API offline — run pnpm dev:api on :4000." />

  return (
    <ModulePanelShell
      kpis={[
        ['Pages', isLoading ? '…' : pages.length, 'default'],
        ['Live', pages.filter((p) => p.isPublished).length, 'success'],
        ['Draft', pages.filter((p) => !p.isPublished).length, 'warning'],
        ['URLs', pages.length ? '/lp/…' : '—', 'gold'],
      ]}
      pipeline={[
        ['Live', pages.filter((p) => p.isPublished).length],
        ['Draft', pages.filter((p) => !p.isPublished).length],
        ['API', 'OK'],
        ['Route', '/lp'],
        ['—', '—'],
      ]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search landing page..."
      createLabel="Create LP"
      onCreate={handleCreate}
      onRefresh={() => void refetch()}
      exportDisabled
      tableIcon={LayoutTemplate}
      tableTitle={`Landing pages · ${filtered.length}`}
      footer="Campaign URLs at /lp/your-slug on storefront"
    >
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--admin-text-muted)]">
          No landing pages yet — click <strong>Create LP</strong> to add a campaign page.
        </p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>URL</th>
              <th>Status</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{p.title}</td>
                <td className="font-mono text-xs">/lp/{p.slug}</td>
                <td>
                  <span className={STATUS_CLASS[p.isPublished ? 'published' : 'draft']}>
                    {p.isPublished ? 'live' : 'draft'}
                  </span>
                </td>
                <td className="muted text-xs">{formatRelativeTime(p.updatedAt)}</td>
                <td>
                  <RowActionsMenu
                    recordName={p.title}
                    moduleHref="/dashboard/landing-pages"
                    recordId={p.id}
                    actions={[
                      {
                        label: 'Edit content',
                        onClick: () => handleEditContent(p),
                      },
                      {
                        label: 'Rename',
                        onClick: () => handleRename(p),
                      },
                      {
                        label: 'View on storefront',
                        onClick: () => window.open(liveUrl(p.slug), '_blank', 'noopener'),
                      },
                      {
                        label: p.isPublished ? 'Unpublish' : 'Publish',
                        onClick: () => togglePublish(p.id, !p.isPublished, p.title),
                      },
                      {
                        label: 'Copy URL',
                        onClick: async () => {
                          const url = liveUrl(p.slug)
                          try {
                            await navigator.clipboard.writeText(url)
                            toast.success('URL copied')
                          } catch {
                            toast.error('Could not copy URL')
                          }
                        },
                      },
                      {
                        label: 'Delete',
                        tone: 'danger',
                        onClick: () => handleDelete(p.id, p.title),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
  )
}

export function HomePagePanelLive() {
  const { data: content, isError, refetch } = useContentOverview()
  const { data: banners = [] } = useBanners()
  const { data: settings } = useSettings()
  const [query, setQuery] = useState('')
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const sections = useMemo(() => {
    const heroCount = banners.filter((b) => b.position === 'hero' && b.isActive).length
    const collections = content?.collections.filter((c) => c.isActive) ?? []
    const campaigns = content?.campaigns ?? []
    const reels = content?.banners.filter((b) => b.isActive) ?? []
    const marqueeOn = settings?.marquee?.enabled ?? false

    return [
      { id: 'hero', name: 'Hero Slider', type: 'Carousel', visible: heroCount > 0 && !hidden.has('hero'), order: 1, source: `${heroCount} banners` },
      { id: 'collections', name: 'Featured Collections', type: 'Grid', visible: collections.length > 0 && !hidden.has('collections'), order: 2, source: `${collections.length} collections` },
      { id: 'arrivals', name: 'New Arrivals', type: 'Product row', visible: !hidden.has('arrivals'), order: 3, source: 'Catalog API' },
      { id: 'campaign', name: 'Campaign banner', type: 'Campaign', visible: campaigns.length > 0 && !hidden.has('campaign'), order: 4, source: campaigns[0]?.name ?? '—' },
      { id: 'categories', name: 'Shop by Category', type: 'Category tiles', visible: !hidden.has('categories'), order: 5, source: `${content?.categories.length ?? 0} categories` },
      { id: 'reels', name: 'Video / Reels strip', type: 'Video strip', visible: reels.length > 0 && !hidden.has('reels'), order: 6, source: `${reels.length} assets` },
      { id: 'marquee', name: 'Announcement marquee', type: 'Ticker', visible: marqueeOn && !hidden.has('marquee'), order: 7, source: settings?.marquee?.items?.length ? `${settings.marquee.items.length} items` : 'Off' },
      { id: 'trust', name: 'Trust badges', type: 'Icons row', visible: !hidden.has('trust'), order: 8, source: 'Storefront default' },
    ]
  }, [banners, content, settings, hidden])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return sections.filter((s) => !q || s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q))
  }, [query, sections])

  const toggleVisible = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    toastInfo('Preview only — section visibility not saved to server.')
  }

  if (isError) return <ApiOfflineBanner message="Content API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Sections', sections.length, 'default'],
        ['Visible', sections.filter((s) => s.visible).length, 'success'],
        ['Hidden', sections.filter((s) => !s.visible).length, 'warning'],
        ['Store', settings?.store.name ?? 'SPLARO', 'gold'],
      ]}
      pipeline={sections.slice(0, 5).map((s) => [s.name.split(' ')[0] ?? s.name, s.visible ? 1 : 0] as [string, number])}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search homepage section..."
      createLabel="Add section"
      onCreate={() => toast('Homepage sections are driven by banners, collections, and settings.', { icon: '🏠' })}
      onRefresh={() => void refetch()}
      exportDisabled
      tableIcon={Home}
      tableTitle={`Homepage sections · ${filtered.length}`}
      footer="Derived from live banners, collections, and storefront settings"
      extraFilters={
        <AdminLinkButton href="https://splaro.co" external size="sm">
          <ExternalLink className="h-3.5 w-3.5" /> Preview storefront
        </AdminLinkButton>
      }
    >
      <table className="admin-module-table">
        <thead>
          <tr>
            <th className="w-8" />
            <th>Section</th>
            <th>Type</th>
            <th>Data source</th>
            <th>Order</th>
            <th>Visible</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id}>
              <td>
                <GripVertical className="h-4 w-4 text-[var(--admin-text-muted)]" />
              </td>
              <td className="font-semibold">{s.name}</td>
              <td className="text-xs">{s.type}</td>
              <td className="text-xs text-[var(--admin-text-muted)]">{s.source}</td>
              <td className="font-bold">{s.order}</td>
              <td>
                <button
                  type="button"
                  onClick={() => toggleVisible(s.id)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-black',
                    s.visible ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/8 text-[var(--admin-text-muted)]',
                  )}
                >
                  {s.visible ? 'Visible' : 'Hidden'}
                </button>
              </td>
              <td>
                <RowActionsMenu recordName={s.name} moduleHref="/dashboard/home-page" recordId={s.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModulePanelShell>
  )
}

export function ThemeBuilderPanelLive() {
  const { data: settings, isError, refetch } = useSettings()
  const branding = settings?.branding
  const store = settings?.store

  const tokens = useMemo(
    () => [
      {
        group: 'Brand',
        tokens: [
          { name: 'Store name', value: store?.name ?? 'SPLARO' },
          { name: 'Logo', value: branding?.logo ? 'Configured' : 'Default' },
          { name: 'Tagline', value: branding?.footerTagline || '—' },
        ],
      },
      {
        group: 'Contact',
        tokens: [
          { name: 'Email', value: settings?.contact.email ?? '—' },
          { name: 'Phone', value: settings?.contact.phone ?? '—' },
          { name: 'WhatsApp', value: settings?.contact.whatsapp ?? '—' },
        ],
      },
      {
        group: 'Theme',
        tokens: [
          { name: 'Primary gold', value: '#5E7CFF' },
          { name: 'Background', value: '#F5F5F7' },
          { name: 'Glass radius', value: '20px' },
        ],
      },
    ],
    [settings, branding, store],
  )

  if (isError) return <ApiOfflineBanner message="Settings API offline." />

  return (
    <div className="space-y-5">
      <ModulePanelShell
        kpis={[
          ['Active theme', 'SPLARO White Glass', 'gold'],
          ['Brand tokens', tokens.reduce((s, g) => s + g.tokens.length, 0), 'default'],
          ['Nav links', settings?.navigation.headerNav.length ?? 0, 'success'],
          ['Footer groups', settings?.navigation.footerGroups.length ?? 0, 'warning'],
        ]}
        pipeline={[['Brand', 3], ['Contact', 3], ['Theme', 3], ['Live', 1], ['API', 1]]}
        query=""
        onQuery={() => {}}
        searchPlaceholder=""
        createLabel="Edit in settings"
        onCreate={() => toast('Branding edits save in Storefront Settings.', { icon: '🎨' })}
        onRefresh={() => void refetch()}
        exportDisabled
        tableIcon={Palette}
        tableTitle="Live brand tokens"
        footer="From storefront settings API"
      >
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Token</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {tokens.flatMap((g) =>
              g.tokens.map((t) => (
                <tr key={`${g.group}-${t.name}`}>
                  <td className="text-xs font-bold text-[var(--admin-text-muted)]">{g.group}</td>
                  <td className="font-semibold">{t.name}</td>
                  <td className="font-mono text-xs">{t.value}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </ModulePanelShell>
      <AdminLinkButton href="/dashboard/settings" variant="gold" size="sm">
        Open storefront settings
      </AdminLinkButton>
    </div>
  )
}

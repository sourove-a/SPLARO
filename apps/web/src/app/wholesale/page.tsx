import { getServerApiBaseUrl } from '@splaro/config'
import { WholesaleForm } from '@/components/wholesale/WholesaleForm'
import { createRouteMetadata } from '@/lib/seo/route-metadata'
import { fetchWithTimeout } from '@/lib/server/build-safe-fetch'

export const metadata = createRouteMetadata({
  title: 'Wholesale & Export — SPLARO',
  description: 'B2B wholesale and export partnership with SPLARO.',
  path: '/wholesale',
})

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

type StockImage = { id: string; url: string; title?: string | null }

async function loadWholesaleStock(): Promise<StockImage[]> {
  try {
    const base = getServerApiBaseUrl()
    const res = await fetchWithTimeout(
      `${base}/storefront/wholesale-stock?storeId=${encodeURIComponent(STORE_ID)}`,
      { next: { revalidate: 30, tags: ['wholesale-stock'] } },
    )
    if (!res?.ok) return []
    const data = (await res.json()) as { images?: StockImage[] }
    return (data.images ?? []).filter((row) => row.url?.trim())
  } catch {
    return []
  }
}

export default async function WholesalePage() {
  const stock = await loadWholesaleStock()
  const heroImage = stock.length > 0 ? stock[0]?.url?.trim() : null
  const gallery = stock.length > 1 ? stock.slice(1) : []

  return (
    <main className="wholesale-page">
      <section className="wholesale-hero" aria-label="Wholesale">
        {heroImage ? (
          <div className="wholesale-hero__media" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt=""
              className="wholesale-hero__image wholesale-hero__image--static"
            />
            <div className="wholesale-hero__veil" />
          </div>
        ) : null}
        <div className="container-luxury wholesale-hero__copy">
          <p className="wholesale-hero__brand">SPLARO</p>
          <h1 className="wholesale-hero__title">Wholesale &amp; export</h1>
          <a href="#wholesale-enquiry" className="wholesale-hero__cta">
            Start enquiry
          </a>
        </div>
      </section>

      {gallery.length > 0 ? (
        <section className="wholesale-stock" aria-label="Wholesale stock">
          <div className="container-luxury wholesale-stock__grid">
            {gallery.map((item) => (
              <figure key={item.id} className="wholesale-stock__item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.title?.trim() || ''}
                  className="wholesale-stock__img"
                />
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <section id="wholesale-enquiry" className="wholesale-form-section">
        <div className="container-luxury wholesale-form-section__inner">
          <div className="wholesale-form-section__intro">
            <h2 className="wholesale-form-section__title">Enquiry</h2>
          </div>
          <WholesaleForm />
        </div>
      </section>
    </main>
  )
}

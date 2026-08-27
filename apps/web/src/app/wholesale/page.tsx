import { getServerApiBaseUrl } from '@splaro/config'
import { WholesaleForm } from '@/components/wholesale/WholesaleForm'
import { createRouteMetadata } from '@/lib/seo/route-metadata'
import { fetchWithTimeout } from '@/lib/server/build-safe-fetch'

export const metadata = createRouteMetadata({
  title: 'Wholesale & Export — SPLARO',
  description:
    'Wholesale and export enquiry for SPLARO — quiet luxury apparel designed in Dhaka. Retail checkout stays Cash on Delivery.',
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
              alt={stock[0]?.title?.trim() || ''}
              className="wholesale-hero__image wholesale-hero__image--static"
            />
            <div className="wholesale-hero__veil" />
          </div>
        ) : null}
        <div className="container-luxury wholesale-hero__copy">
          <p className="wholesale-hero__brand">SPLARO</p>
          <h1 className="wholesale-hero__title">Wholesale &amp; export</h1>
          <p className="wholesale-hero__lede">
            Quiet luxury apparel designed in Dhaka — for retailers, distributors, and export
            partners. Share your order volume and we will reply with availability. This page is an
            enquiry, not an online wholesale checkout; the retail shop remains Cash on Delivery.
          </p>
          <a href="#wholesale-enquiry" className="wholesale-hero__cta">
            Start enquiry
          </a>
        </div>
      </section>

      <section className="wholesale-points" aria-label="How wholesale works">
        <div className="container-luxury wholesale-points__grid">
          <article className="wholesale-point">
            <span className="wholesale-point__icon" aria-hidden="true">
              01
            </span>
            <div>
              <h2 className="wholesale-point__title">Designed in Dhaka</h2>
              <p className="wholesale-point__body">
                Collections developed here for this climate and fit — not imported for another market.
              </p>
            </div>
          </article>
          <article className="wholesale-point">
            <span className="wholesale-point__icon" aria-hidden="true">
              02
            </span>
            <div>
              <h2 className="wholesale-point__title">Women, men &amp; kids</h2>
              <p className="wholesale-point__body">
                Apparel we actually produce. We do not quote styles we cannot deliver.
              </p>
            </div>
          </article>
          <article className="wholesale-point">
            <span className="wholesale-point__icon" aria-hidden="true">
              03
            </span>
            <div>
              <h2 className="wholesale-point__title">Bangladesh &amp; export</h2>
              <p className="wholesale-point__body">
                Domestic retailers and export partners. Tell us the destination in the form.
              </p>
            </div>
          </article>
          <article className="wholesale-point">
            <span className="wholesale-point__icon" aria-hidden="true">
              04
            </span>
            <div>
              <h2 className="wholesale-point__title">Enquiry, not checkout</h2>
              <p className="wholesale-point__body">
                No wholesale cart or published MOQ here. We reply with stock and terms after you write.
              </p>
            </div>
          </article>
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
                  alt={item.title?.trim() || 'SPLARO wholesale stock'}
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

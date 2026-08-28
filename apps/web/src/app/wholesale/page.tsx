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

type Tier = {
  id: string
  slug: string
  name: string
  minUnits: number
  leadTimeDays?: number | null
  summary?: string | null
  perks?: string[]
}

/**
 * Published programme steps. The shop decides whether to publish indicative
 * MOQs at all — with no active tiers this returns empty and the page stays the
 * enquiry-only piece it has always been, rather than showing hollow cards.
 */
async function loadWholesaleTiers(): Promise<Tier[]> {
  try {
    const base = getServerApiBaseUrl()
    const res = await fetchWithTimeout(
      `${base}/storefront/wholesale-tiers?storeId=${encodeURIComponent(STORE_ID)}`,
      { next: { revalidate: 60, tags: ['wholesale-tiers'] } },
    )
    if (!res?.ok) return []
    const data = (await res.json()) as { tiers?: Tier[] }
    return (data.tiers ?? []).filter((tier) => tier.slug?.trim() && tier.name?.trim())
  } catch {
    return []
  }
}

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
  const [stock, tiers] = await Promise.all([loadWholesaleStock(), loadWholesaleTiers()])
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

      {tiers.length > 0 ? (
        <section className="wholesale-tiers" aria-label="Wholesale programme">
          <div className="container-luxury">
            <header className="wholesale-tiers__head">
              <p className="wholesale-tiers__eyebrow">Programme</p>
              <h2 className="wholesale-tiers__title">Where you fit</h2>
              <p className="wholesale-tiers__lede">
                Indicative volumes and lead times. Final terms are quoted against your
                assortment — tell us where you sit and we will reply with real numbers.
              </p>
            </header>

            <div className="wholesale-tiers__grid">
              {tiers.map((tier, index) => (
                <article key={tier.id} className="wholesale-tier">
                  <span className="wholesale-tier__index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="wholesale-tier__name">{tier.name}</h3>

                  <dl className="wholesale-tier__facts">
                    {tier.minUnits > 0 ? (
                      <div className="wholesale-tier__fact">
                        <dt>From</dt>
                        <dd>{tier.minUnits.toLocaleString('en-US')} pcs</dd>
                      </div>
                    ) : null}
                    {tier.leadTimeDays ? (
                      <div className="wholesale-tier__fact">
                        <dt>Lead time</dt>
                        <dd>{tier.leadTimeDays} days</dd>
                      </div>
                    ) : null}
                  </dl>

                  {tier.summary ? (
                    <p className="wholesale-tier__summary">{tier.summary}</p>
                  ) : null}

                  {tier.perks?.length ? (
                    <ul className="wholesale-tier__perks">
                      {tier.perks.map((perk) => (
                        <li key={perk}>{perk}</li>
                      ))}
                    </ul>
                  ) : null}

                  <a href="#wholesale-enquiry" className="wholesale-tier__cta">
                    Enquire as {tier.name}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

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
          <WholesaleForm
            tiers={tiers.map((tier) => ({
              slug: tier.slug,
              name: tier.name,
              minUnits: tier.minUnits,
            }))}
          />
        </div>
      </section>
    </main>
  )
}

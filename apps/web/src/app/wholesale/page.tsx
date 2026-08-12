import { Factory, Globe2, PackageCheck, Ruler } from 'lucide-react'
import { WholesaleForm } from '@/components/wholesale/WholesaleForm'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

export const metadata = createRouteMetadata({
  title: 'Wholesale & Export — SPLARO',
  description:
    'Stock SPLARO in your store or import our collections. Share your requirement and our wholesale team will get back to you.',
  path: '/wholesale',
})

const POINTS = [
  {
    icon: Factory,
    title: 'Made in our own studio',
    body: 'Every piece is cut and finished in-house, so bulk runs keep the same fit and finish as retail.',
  },
  {
    icon: Globe2,
    title: 'Export ready',
    body: 'We ship to overseas buyers with export documentation and consolidated packing.',
  },
  {
    icon: PackageCheck,
    title: 'Wholesale pricing',
    body: 'Tiered pricing by quantity, quoted after we understand your range and volume.',
  },
  {
    icon: Ruler,
    title: 'Custom sizing & labels',
    body: 'Size sets, private labelling, and packaging can be adapted for your market.',
  },
]

export default function WholesalePage() {
  return (
    <main className="wholesale-page">
      <section className="wholesale-hero">
        <div className="container-luxury">
          <span className="wholesale-hero__eyebrow">Wholesale &amp; Export</span>
          <h1 className="wholesale-hero__title">Carry SPLARO in your market.</h1>
          <p className="wholesale-hero__lede">
            We supply retailers, distributors and importers at wholesale volumes — from a single
            boutique order to container shipments. Tell us what you need and our team will come back
            with pricing and lead times.
          </p>
        </div>
      </section>

      <section className="wholesale-points">
        <div className="container-luxury wholesale-points__grid">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="wholesale-point">
              <span className="wholesale-point__icon" aria-hidden="true">
                <Icon className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <h2 className="wholesale-point__title">{title}</h2>
              <p className="wholesale-point__body">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="wholesale-form-section">
        <div className="container-luxury wholesale-form-section__inner">
          <div className="wholesale-form-section__intro">
            <h2 className="wholesale-form-section__title">Wholesale enquiry</h2>
            <p className="wholesale-form-section__text">
              Fields marked <span aria-hidden="true">*</span> are required. The more you share about
              your market and volume, the faster we can quote.
            </p>
          </div>
          <WholesaleForm />
        </div>
      </section>
    </main>
  )
}

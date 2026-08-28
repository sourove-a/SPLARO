import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Sparkles } from 'lucide-react'

import { AccountGlass } from '@/components/account/AccountGlass'
import { Button } from '@/components/ui/Button'
import type { SitePageSection } from '@/lib/content/site-pages'

interface ContentCampaignLandingProps {
  title: string
  description: string
  sections: SitePageSection[]
}

export function ContentCampaignLanding({
  title,
  description,
  sections,
}: ContentCampaignLandingProps) {
  return (
    <div className="content-page campaign-landing account-shell">
      <div className="account-shell__ambient" aria-hidden="true" />

      <div className="campaign-landing__layout">
        <section className="campaign-landing__hero" aria-labelledby="campaign-title">
          <div className="campaign-landing__art" aria-hidden="true">
            <span className="campaign-landing__art-ring campaign-landing__art-ring--outer" />
            <span className="campaign-landing__art-ring campaign-landing__art-ring--inner" />
            <span className="campaign-landing__art-glow" />
            <span className="campaign-landing__art-mark">S</span>
          </div>

          <div className="campaign-landing__hero-copy">
            <Link href="/" className="content-page__back campaign-landing__back">
              <ArrowLeft className="h-4 w-4" strokeWidth={2.1} />
              Back to home
            </Link>
            <p className="campaign-landing__eyebrow">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
              SPLARO / Limited edit
            </p>
            <h1 id="campaign-title" className="campaign-landing__title">
              {title}
            </h1>
            <p className="campaign-landing__description">{description}</p>
            <Button href="/shop" variant="secondary" className="campaign-landing__cta">
              Explore the collection
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
            </Button>
          </div>

          <div className="campaign-landing__stamp" aria-hidden="true">
            <span>Curated</span>
            <strong>2026</strong>
          </div>
        </section>

        <section className="campaign-landing__details" aria-label="Campaign details">
          {sections.map((section, index) => (
            <AccountGlass key={`${section.heading}-${index}`} className="campaign-landing__detail">
              <p className="campaign-landing__detail-index">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h2 className="campaign-landing__detail-title">{section.heading}</h2>
              <p className="campaign-landing__detail-body">{section.body}</p>
            </AccountGlass>
          ))}
        </section>
      </div>
    </div>
  )
}

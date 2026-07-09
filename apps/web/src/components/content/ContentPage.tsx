import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AccountGlass } from '@/components/account/AccountGlass'
import { ContentPremiumAbout } from '@/components/content/ContentPremiumAbout'
import { ContentPremiumFaq } from '@/components/content/ContentPremiumFaq'
import { ContentPremiumLegal } from '@/components/content/ContentPremiumLegal'
import { ContentSectionGrid } from '@/components/content/ContentSectionGrid'
import type { SitePageSection } from '@/lib/content/site-pages'

interface ContentPageProps {
  title: string
  description: string
  sections: SitePageSection[]
  children?: ReactNode
  variant?: 'default' | 'boxed' | 'premium' | 'about' | 'faq'
  premiumBadge?: string
}

export function ContentPage({
  title,
  description,
  sections,
  children,
  variant = 'default',
  premiumBadge,
}: ContentPageProps) {
  if (variant === 'premium') {
    return (
      <ContentPremiumLegal
        title={title}
        description={description}
        sections={sections}
        {...(premiumBadge ? { badge: premiumBadge } : {})}
      />
    )
  }

  if (variant === 'about') {
    return (
      <ContentPremiumAbout
        title={title}
        description={description}
        sections={sections}
        {...(premiumBadge ? { badge: premiumBadge } : {})}
      />
    )
  }

  if (variant === 'faq') {
    return (
      <ContentPremiumFaq
        title={title}
        description={description}
        sections={sections}
        {...(premiumBadge ? { badge: premiumBadge } : {})}
      />
    )
  }

  return (
    <div className="content-page account-shell">
      <div className="account-shell__ambient" aria-hidden="true" />

      <div className="content-page__layout">
        <AccountGlass className="content-page__header">
          <Link href="/" className="content-page__back">
            <ArrowLeft className="h-4 w-4" strokeWidth={2.1} />
            Back to home
          </Link>
          <p className="content-page__eyebrow">SPLARO</p>
          <h1 className="content-page__title">{title}</h1>
          <p className="content-page__description">{description}</p>
        </AccountGlass>

        {variant === 'boxed' ? (
          <>
            <ContentSectionGrid sections={sections} />
            {children}
          </>
        ) : (
          <AccountGlass className="content-page__body-wrap">
            <div className="content-page__body">
              {sections.map((section) => (
                <section key={section.heading} className="content-page__section">
                  <h2 className="content-page__section-title">{section.heading}</h2>
                  <p className="content-page__section-body">{section.body}</p>
                </section>
              ))}
              {children}
            </div>
          </AccountGlass>
        )}
      </div>
    </div>
  )
}

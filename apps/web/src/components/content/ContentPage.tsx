import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { SitePageSection } from '@/lib/content/site-pages'

interface ContentPageProps {
  title: string
  description: string
  sections: SitePageSection[]
  children?: ReactNode
}

export function ContentPage({ title, description, sections, children }: ContentPageProps) {
  return (
    <div className="content-page account-shell">
      <div className="account-shell__ambient" aria-hidden="true" />

      <div className="content-page__layout">
        <header className="content-page__header account-glass">
          <Link href="/" className="content-page__back">
            <ArrowLeft className="h-4 w-4" strokeWidth={2.1} />
            Back to home
          </Link>
          <p className="content-page__eyebrow">SPLARO</p>
          <h1 className="content-page__title">{title}</h1>
          <p className="content-page__description">{description}</p>
        </header>

        <div className="content-page__body account-glass">
          {sections.map((section) => (
            <section key={section.heading} className="content-page__section">
              <h2 className="content-page__section-title">{section.heading}</h2>
              <p className="content-page__section-body">{section.body}</p>
            </section>
          ))}
          {children}
        </div>
      </div>
    </div>
  )
}

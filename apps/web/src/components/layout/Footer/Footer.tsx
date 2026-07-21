'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion } from '@/lib/motion/react'
import {
  ChevronDown,
  MapPin,
  MessageCircle,
  Phone,
} from 'lucide-react'
import { SplaroBrandLogo } from '@/components/brand/SplaroBrandLogo'
import { SOCIAL_BRAND_ICONS } from '@/components/ui/SocialBrandIcons'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import {
  DEFAULT_STORE_ADDRESS,
  DEFAULT_STORE_LABEL,
  DEFAULT_SUPPORT_EMAIL,
} from '@/lib/storefront/defaults'
import { getStorefrontSocialLinks } from '@/lib/storefront/social-links'
import { cn } from '@/lib/utils/cn'

const CURRENT_YEAR = new Date().getFullYear()

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: { label: string; href: string; external?: boolean }[]
}) {
  return (
    <div className="footer-lux__column">
      <h3 className="footer-lux__heading">{title}</h3>
      <ul className="footer-lux__links">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            {link.external ? (
              <a href={link.href} target="_blank" rel="noopener noreferrer" className="footer-lux__link">
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="footer-lux__link">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FooterAccordion({
  id,
  title,
  links,
  open,
  onToggle,
}: {
  id: string
  title: string
  links: { label: string; href: string; external?: boolean }[]
  open: boolean
  onToggle: () => void
}) {
  return (
    <section className={cn('footer-lux__accordion', open && 'footer-lux__accordion--open')}>
      <button
        type="button"
        className="footer-lux__accordion-trigger"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`footer-panel-${id}`}
      >
        <span className="footer-lux__accordion-title">{title}</span>
        <span className="footer-lux__accordion-chevron-wrap" aria-hidden>
          <ChevronDown
            className={cn('footer-lux__accordion-chevron', open && 'footer-lux__accordion-chevron--open')}
            strokeWidth={1.75}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`footer-panel-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul className="footer-lux__accordion-panel">
              {links.map((link) => (
                <li key={`${id}-${link.label}`}>
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className="footer-lux__link footer-lux__link--panel">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="footer-lux__link footer-lux__link--panel">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

export function Footer() {
  const settings = useStorefrontSettings()
  const [openSection, setOpenSection] = useState<string>('')

  const phone = settings.store.phone || process.env.NEXT_PUBLIC_SUPPORT_PHONE || ''
  const email = settings.store.email || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL
  // 1:1 with admin Contact & Social → WhatsApp; falls back to store phone when empty.
  const whatsapp = settings.social.whatsapp || settings.store.phone || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
  const tagline = settings.config.footerTagline?.trim() ?? ''
  const copyright = settings.config.footerCopyright?.trim() || `© ${CURRENT_YEAR} ${settings.store.name}. All rights reserved.`
  const linkGroups = settings.config.footerGroups ?? []
  const storeImage = settings.config.storeImage?.trim()
  const storeLabel = settings.config.storeLabel?.trim() || DEFAULT_STORE_LABEL
  const address = settings.store.address?.trim() || DEFAULT_STORE_ADDRESS
  const addressMobile = (() => {
    const flat = address.replace(/\s+/g, ' ').replace(/^SPLARO,?\s*/i, '').trim()
    const parts = flat.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 3) {
      const area = parts[parts.length - 3]
      const city = parts[parts.length - 2]?.replace(/\s+\d{4}$/, '') || parts[parts.length - 2]
      return [area, city].filter(Boolean).join(' · ')
    }
    if (parts.length === 2) return parts.join(' · ')
    return flat.length > 42 ? `${flat.slice(0, 40)}…` : flat
  })()

  const socialLinks = getStorefrontSocialLinks(settings)

  return (
    <footer data-site-chrome className="site-footer site-footer--luxury" aria-label="Site footer">
      <div className="site-footer__stage">
        <div className="site-footer__ambient" aria-hidden="true" />

        <div className="container-luxury site-footer__wrap">
          <div className="footer-lux__panel">
            <div className="footer-lux__glass-surface" aria-hidden="true" />
            <div className="footer-lux__sheen" aria-hidden="true" />

            <div className="footer-lux__body">
              <div className="footer-lux__top">
                <div className="footer-lux__brand">
                  <div className="footer-lux__logo-wrap">
                    <span className="footer-lux__logo-glow" aria-hidden />
                    <SplaroBrandLogo
                      href="/"
                      size="footerLuxury"
                      tone="dark"
                      className="footer-lux__logo"
                    />
                  </div>
                  {tagline ? <p className="footer-lux__tagline">{tagline}</p> : null}
                  <Link href="/stores" className="footer-lux__address-mobile">
                    <span className="footer-lux__address-mobile-seal" aria-hidden>
                      <MapPin className="footer-lux__address-mobile-icon" strokeWidth={1.8} />
                    </span>
                    <span className="footer-lux__address-mobile-copy">
                      <span className="footer-lux__address-mobile-label">Visit store</span>
                      <span className="footer-lux__address-mobile-place">{addressMobile}</span>
                    </span>
                  </Link>
                </div>

                <div className="footer-lux__store-card">
                  <div className="footer-lux__store-copy">
                    <div className="footer-lux__store-icon">
                      <MapPin className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div>
                      {storeLabel ? (
                        <p className="footer-lux__store-label">{storeLabel}</p>
                      ) : null}
                      <address className="footer-lux__store-address whitespace-pre-line not-italic">
                        {address}
                      </address>
                    </div>
                  </div>
                  {storeImage ? (
                    <div className="footer-lux__store-visual">
                      <Image src={storeImage} alt={storeLabel} fill sizes="180px" className="object-cover" unoptimized />
                    </div>
                  ) : null}
                </div>
              </div>

            {linkGroups.length > 0 ? (
              <>
                <div className="footer-lux__columns hidden lg:grid">
                  {linkGroups.map((group) => (
                    <FooterColumn key={group.id} title={group.title} links={group.links} />
                  ))}
                </div>
                <div className="footer-lux__accordions lg:hidden">
                  {linkGroups.map((group) => (
                    <FooterAccordion
                      key={group.id}
                      id={group.id}
                      title={group.title}
                      links={group.links}
                      open={openSection === group.id}
                      onToggle={() => setOpenSection((current) => (current === group.id ? '' : group.id))}
                    />
                  ))}
                </div>
              </>
            ) : null}

            <div className="footer-lux__contact-row">
              <div className="footer-lux__contact-block">
                <p className="footer-lux__micro-label">Contact</p>
                <div className="footer-lux__pills">
                  {phone ? (
                    <a
                      href={`tel:${phone.replace(/[^0-9+]/g, '')}`}
                      className="footer-lux__pill"
                      aria-label={`Call ${phone}`}
                      title={phone}
                    >
                      <span className="footer-lux__pill-icon" aria-hidden="true">
                        <Phone className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </span>
                      <span className="footer-lux__pill-text footer-lux__pill-text--full">{phone}</span>
                      <span className="footer-lux__pill-text footer-lux__pill-text--short" aria-hidden>
                        Call
                      </span>
                    </a>
                  ) : null}
                  {email ? (
                    <a
                      href={`mailto:${email}`}
                      className="footer-lux__pill"
                      aria-label={`Email ${email}`}
                      title={email}
                    >
                      <span className="footer-lux__pill-icon footer-lux__pill-icon--email" aria-hidden="true">
                        <svg className="footer-lux__email-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M3.75 7.4c0-.97.79-1.75 1.75-1.75h13c.97 0 1.75.78 1.75 1.75v9.2c0 .97-.78 1.75-1.75 1.75h-13c-.96 0-1.75-.78-1.75-1.75V7.4Z"
                            fill="rgba(255,255,255,0.06)"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                          <path
                            d="M4.2 6.95 11.15 12.4a1.5 1.5 0 0 0 1.7 0L19.8 6.95"
                            stroke="currentColor"
                            strokeWidth="1.55"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M4.35 16.85 9.2 12.55M19.65 16.85 14.8 12.55"
                            stroke="currentColor"
                            strokeWidth="1.15"
                            strokeLinecap="round"
                            opacity="0.4"
                          />
                        </svg>
                      </span>
                      <span className="footer-lux__pill-text footer-lux__pill-text--full">{email}</span>
                      <span className="footer-lux__pill-text footer-lux__pill-text--short" aria-hidden>
                        Email
                      </span>
                    </a>
                  ) : null}
                  {whatsapp ? (
                    <a
                      href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-lux__pill footer-lux__pill--whatsapp"
                      aria-label="WhatsApp"
                      title="WhatsApp"
                    >
                      <span className="footer-lux__pill-icon footer-lux__pill-icon--whatsapp" aria-hidden="true">
                        <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </span>
                      <span className="footer-lux__pill-text">WhatsApp</span>
                    </a>
                  ) : null}
                </div>
              </div>

              {socialLinks.length > 0 ? (
                <div className="footer-lux__social-block">
                  <p className="footer-lux__micro-label">Follow {settings.store.name}</p>
                  <div className="footer-lux__social">
                    {socialLinks.map((item) => {
                      const Icon = SOCIAL_BRAND_ICONS[item.id]
                      return (
                        <a
                          key={item.id}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn('footer-lux__social-btn', `footer-lux__social-btn--${item.id}`)}
                          aria-label={item.label}
                          title={item.label}
                        >
                          <Icon />
                        </a>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="footer-lux__bottom">
              {socialLinks.length > 0 ? (
                <div className="footer-lux__social footer-lux__social--bottom" aria-label={`Follow ${settings.store.name}`}>
                  {socialLinks.map((item) => {
                    const Icon = SOCIAL_BRAND_ICONS[item.id]
                    return (
                      <a
                        key={`bottom-${item.id}`}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn('footer-lux__social-btn', `footer-lux__social-btn--${item.id}`)}
                        aria-label={item.label}
                        title={item.label}
                      >
                        <Icon />
                      </a>
                    )
                  })}
                </div>
              ) : null}
              <p className="footer-lux__copy">{copyright}</p>
            </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

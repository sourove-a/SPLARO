'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from 'lucide-react'
import { SplaroBrandLogo, logoUrlProp } from '@/components/brand/SplaroBrandLogo'
import { SOCIAL_BRAND_ICONS } from '@/components/ui/SocialBrandIcons'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { DEFAULT_STORE_ADDRESS, DEFAULT_STORE_LABEL } from '@/lib/storefront/defaults'
import { getStorefrontSocialLinks } from '@/lib/storefront/social-links'
import { cn } from '@/lib/utils/cn'
import { LazyFooterEarthGlobe } from '@/components/earth/LazyFooterEarthGlobe'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

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
        <span>{title}</span>
        <ChevronDown
          className={cn('footer-lux__accordion-chevron', open && 'footer-lux__accordion-chevron--open')}
          strokeWidth={2.2}
        />
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
  const email = settings.store.email || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@splaro.com.bd'
  // 1:1 with admin Contact & Social → WhatsApp; falls back to store phone when empty.
  const whatsapp = settings.social.whatsapp || settings.store.phone || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
  const tagline = settings.config.footerTagline?.trim() ?? ''
  const copyright = settings.config.footerCopyright?.trim() || `© ${CURRENT_YEAR} ${settings.store.name}. All rights reserved.`
  const linkGroups = settings.config.footerGroups ?? []
  const storeImage = settings.config.storeImage?.trim()
  const storeLabel = settings.config.storeLabel?.trim() || DEFAULT_STORE_LABEL
  const address = settings.store.address?.trim() || DEFAULT_STORE_ADDRESS

  const socialLinks = getStorefrontSocialLinks(settings)

  return (
    <footer data-site-chrome className="site-footer site-footer--luxury" aria-label="Site footer">
      <div className="site-footer__stage">
        <LazyFooterEarthGlobe />
        <div className="site-footer__ambient" aria-hidden="true" />

        <div className="container-luxury site-footer__wrap">
          <ScrollReveal variant="fadeUp">
          <div className="footer-lux__panel">
            <div className="footer-lux__glass-surface" aria-hidden="true" />
            <div className="footer-lux__sheen" aria-hidden="true" />

            <div className="footer-lux__body">
              <div className="footer-lux__top">
                <div className="footer-lux__brand">
                  <SplaroBrandLogo
                    href="/"
                    size="footerLuxury"
                    tone="dark"
                    className="footer-lux__logo"
                    {...logoUrlProp(settings.store.logo)}
                  />
                  {tagline ? <p className="footer-lux__tagline">{tagline}</p> : null}
                </div>

                <div className="footer-lux__store-card hidden lg:flex">
                  <div className="footer-lux__store-copy">
                    <div className="footer-lux__store-icon">
                      <MapPin className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="footer-lux__store-label">{storeLabel}</p>
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
                    <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`} className="footer-lux__pill">
                      <span className="footer-lux__pill-icon" aria-hidden="true">
                        <Phone className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </span>
                      {phone}
                    </a>
                  ) : null}
                  {email ? (
                    <a href={`mailto:${email}`} className="footer-lux__pill">
                      <span className="footer-lux__pill-icon" aria-hidden="true">
                        <Mail className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </span>
                      {email}
                    </a>
                  ) : null}
                  {whatsapp ? (
                    <a
                      href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-lux__pill footer-lux__pill--whatsapp"
                    >
                      <span className="footer-lux__pill-icon footer-lux__pill-icon--whatsapp" aria-hidden="true">
                        <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </span>
                      WhatsApp
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
              <p className="footer-lux__copy">{copyright}</p>
            </div>
            </div>
          </div>
          </ScrollReveal>
        </div>
      </div>
    </footer>
  )
}

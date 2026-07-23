'use client'

import { useState, type ComponentType } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import {
  Building2,
  ChevronDown,
  FileText,
  Headphones,
  MapPin,
  ShoppingBag,
} from 'lucide-react'
import { SplaroBrandLogo } from '@/components/brand/SplaroBrandLogo'
import {
  SOCIAL_BRAND_ICONS,
  SplaroMailIcon,
  SplaroPhoneIcon,
  SplaroWhatsAppIcon,
} from '@/components/ui/SocialBrandIcons'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import {
  DEFAULT_STORE_ADDRESS,
  DEFAULT_SUPPORT_EMAIL,
} from '@/lib/storefront/defaults'
import { getStorefrontSocialLinks } from '@/lib/storefront/social-links'
import { cn } from '@/lib/utils/cn'

const CURRENT_YEAR = new Date().getFullYear()

const ACCORDION_ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  shop: ShoppingBag,
  care: Headphones,
  company: Building2,
  policies: FileText,
}

function splitStoreAddress(address: string) {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 2) return { place: address, country: '' }
  return {
    place: parts.slice(0, -1).join(', '),
    country: parts[parts.length - 1] ?? '',
  }
}

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
  reduceMotion,
}: {
  id: string
  title: string
  links: { label: string; href: string; external?: boolean }[]
  open: boolean
  onToggle: () => void
  reduceMotion: boolean
}) {
  const Icon = ACCORDION_ICONS[id] ?? FileText

  return (
    <section className={cn('footer-lux__accordion', open && 'footer-lux__accordion--open')}>
      <button
        type="button"
        className="footer-lux__accordion-trigger"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`footer-panel-${id}`}
      >
        <span className="footer-lux__accordion-lead">
          <span className="footer-lux__accordion-icon" aria-hidden>
            <Icon className="footer-lux__accordion-glyph" strokeWidth={1.5} />
          </span>
          <span className="footer-lux__accordion-title">{title}</span>
        </span>
        <span className="footer-lux__accordion-chevron-wrap" aria-hidden>
          <ChevronDown
            className={cn('footer-lux__accordion-chevron', open && 'footer-lux__accordion-chevron--open')}
            strokeWidth={1.5}
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
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
            }
            className="overflow-hidden"
          >
            <ul className="footer-lux__accordion-panel">
              {links.map((link) => (
                <li key={`${id}-${link.label}`}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-lux__link footer-lux__link--panel"
                    >
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

function FooterSocialButton({
  href,
  label,
  id,
}: {
  href: string
  label: string
  id: string
}) {
  const Icon = SOCIAL_BRAND_ICONS[id as keyof typeof SOCIAL_BRAND_ICONS]
  if (!Icon) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('footer-lux__social-btn', `footer-lux__social-btn--${id}`)}
      aria-label={label}
      title={label}
    >
      <Icon className="footer-lux__social-glyph" />
    </a>
  )
}

export function Footer() {
  const settings = useStorefrontSettings()
  const reduceMotion = useReducedMotion() ?? false
  const [openSection, setOpenSection] = useState<string>('')

  const phone = settings.store.phone || process.env.NEXT_PUBLIC_SUPPORT_PHONE || ''
  const email = settings.store.email || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL
  // 1:1 with admin Contact & Social → WhatsApp; falls back to store phone when empty.
  const whatsapp = settings.social.whatsapp || settings.store.phone || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
  const tagline = settings.config.footerTagline?.trim() ?? ''
  const copyright =
    settings.config.footerCopyright?.trim() ||
    `© ${CURRENT_YEAR} ${settings.store.name}. All rights reserved.`
  const linkGroups = settings.config.footerGroups ?? []
  // Same full store address on every page (home / journal / shipping) — never shorten.
  const address = (settings.store.address?.trim() || DEFAULT_STORE_ADDRESS)
    .replace(/\s+/g, ' ')
    .replace(/^SPLARO,?\s*/i, '')
    .trim()
  const { place, country } = splitStoreAddress(address)

  const socialLinks = getStorefrontSocialLinks(settings)
  const visitStoreLabel = `Visit store — ${address}`

  return (
    <footer data-site-chrome className="site-footer site-footer--luxury" aria-label="Site footer">
      <div className="site-footer__stage">
        <div className="site-footer__ambient" aria-hidden="true" />

        <div className="container-luxury site-footer__wrap">
          <div className="footer-lux__panel">
            <div className="footer-lux__body">
              <div className="footer-lux__top">
                <div className="footer-lux__brand">
                  <div className="footer-lux__logo-wrap">
                    <SplaroBrandLogo
                      href="/"
                      size="footerLuxury"
                      tone="light"
                      className="footer-lux__logo"
                    />
                  </div>
                  {tagline ? <p className="footer-lux__tagline">{tagline}</p> : null}

                  <Link
                    href="/stores"
                    className="footer-lux__address-mobile"
                    aria-label={visitStoreLabel}
                  >
                    <span className="footer-lux__address-mobile-seal" aria-hidden>
                      <MapPin className="footer-lux__address-mobile-icon" strokeWidth={1.5} />
                    </span>
                    <span className="footer-lux__address-mobile-copy">
                      <span className="footer-lux__address-mobile-label">Visit store</span>
                      <span className="footer-lux__address-mobile-place">{place}</span>
                      {country ? (
                        <span className="footer-lux__address-mobile-country">{country}</span>
                      ) : null}
                    </span>
                  </Link>
                </div>

                <Link
                  href="/stores"
                  className="footer-lux__store-card"
                  title={address}
                  aria-label={visitStoreLabel}
                >
                  <span className="footer-lux__store-copy-text">
                    <span className="footer-lux__store-label">Visit store</span>
                    <span className="footer-lux__store-address">{address}</span>
                  </span>
                </Link>
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
                        onToggle={() =>
                          setOpenSection((current) => (current === group.id ? '' : group.id))
                        }
                        reduceMotion={reduceMotion}
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
                        className="footer-lux__pill footer-lux__pill--phone"
                        aria-label={`Call ${phone}`}
                        title={phone}
                      >
                        <span className="footer-lux__pill-icon" aria-hidden="true">
                          <SplaroPhoneIcon className="footer-lux__contact-glyph" />
                        </span>
                        <span className="footer-lux__pill-copy">
                          <span className="footer-lux__pill-kicker">Phone</span>
                          <span className="footer-lux__pill-text footer-lux__pill-text--full">{phone}</span>
                        </span>
                        <span className="footer-lux__pill-text footer-lux__pill-text--short" aria-hidden>
                          Call
                        </span>
                      </a>
                    ) : null}
                    {email ? (
                      <a
                        href={`mailto:${email}`}
                        className="footer-lux__pill footer-lux__pill--email"
                        aria-label={`Email ${email}`}
                        title={email}
                      >
                        <span className="footer-lux__pill-icon footer-lux__pill-icon--email" aria-hidden="true">
                          <SplaroMailIcon className="footer-lux__email-svg footer-lux__contact-glyph" />
                        </span>
                        <span className="footer-lux__pill-copy">
                          <span className="footer-lux__pill-kicker">Email</span>
                          <span className="footer-lux__pill-text footer-lux__pill-text--full">{email}</span>
                        </span>
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
                        <span
                          className="footer-lux__pill-icon footer-lux__pill-icon--whatsapp"
                          aria-hidden="true"
                        >
                          <SplaroWhatsAppIcon className="footer-lux__contact-glyph" />
                        </span>
                        <span className="footer-lux__pill-copy">
                          <span className="footer-lux__pill-kicker">Message</span>
                          <span className="footer-lux__pill-text footer-lux__pill-text--full">WhatsApp</span>
                        </span>
                        <span className="footer-lux__pill-text footer-lux__pill-text--short" aria-hidden>
                          Chat
                        </span>
                      </a>
                    ) : null}
                  </div>
                </div>

                {socialLinks.length > 0 ? (
                  <div className="footer-lux__social-block">
                    <p className="footer-lux__micro-label">Follow {settings.store.name}</p>
                    <div className="footer-lux__social">
                      {socialLinks.map((item) => (
                        <FooterSocialButton
                          key={item.id}
                          id={item.id}
                          href={item.href}
                          label={item.label}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="footer-lux__bottom">
                {socialLinks.length > 0 ? (
                  <div
                    className="footer-lux__social footer-lux__social--bottom"
                    aria-label={`Follow ${settings.store.name}`}
                  >
                    {socialLinks.map((item) => (
                      <FooterSocialButton
                        key={`bottom-${item.id}`}
                        id={item.id}
                        href={item.href}
                        label={item.label}
                      />
                    ))}
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

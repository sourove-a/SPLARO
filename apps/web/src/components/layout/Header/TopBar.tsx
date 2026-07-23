'use client'

import Link from 'next/link'
import { Mail, PackageSearch, Phone, Truck } from 'lucide-react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { DEFAULT_SUPPORT_EMAIL } from '@/lib/storefront/defaults'

const linkClass = 'site-topbar__link'

export function TopBar() {
  const settings = useStorefrontSettings()
  const email =
    settings.store.email?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    DEFAULT_SUPPORT_EMAIL
  const phone =
    settings.store.phone?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() ||
    ''

  return (
    <div className="site-topbar z-chrome-header" data-site-chrome data-top-bar>
      <div className="site-topbar__inner">
        <div className="site-topbar__group">
          <span className="site-topbar__label">৳ BDT</span>
          <span className="site-topbar__divider" aria-hidden="true" />
          <Link href={`mailto:${email}`} className={linkClass}>
            <Mail className="h-4 w-4 shrink-0" strokeWidth={1.85} />
            <span className="max-w-[14rem] truncate normal-case tracking-[0.04em]">{email}</span>
          </Link>
          <span className="site-topbar__divider" aria-hidden="true" />
          {phone ? (
            <Link href={`tel:${phone.replace(/\s/g, '')}`} className={linkClass}>
              <Phone className="h-4 w-4 shrink-0" strokeWidth={1.85} />
              Contact
            </Link>
          ) : (
            <Link href="/contact" className={linkClass}>
              <Phone className="h-4 w-4 shrink-0" strokeWidth={1.85} />
              Contact
            </Link>
          )}
        </div>

        <div className="site-topbar__group site-topbar__group--icons">
          <span
            className={`${linkClass} site-topbar__icon-only cursor-default`}
            title="Fast delivery"
            aria-label="Fast delivery"
          >
            <Truck className="h-4 w-4 shrink-0" strokeWidth={1.85} />
          </span>
          <span className="site-topbar__divider" aria-hidden="true" />
          <Link
            href="/track-order"
            className={`${linkClass} site-topbar__icon-only`}
            title="Track order"
            aria-label="Track order"
          >
            <PackageSearch className="h-4 w-4 shrink-0" strokeWidth={1.85} />
          </Link>
        </div>
      </div>
    </div>
  )
}

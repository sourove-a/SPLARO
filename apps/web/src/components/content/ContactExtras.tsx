'use client'

import { type FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react'

import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { MotionAnchor, MotionPressable } from '@/components/ui/MotionPressable'
import { submitContactForm } from '@/lib/api/contact'
import { resolveWhatsAppNumber, resolveSupportPhone, whatsAppHref } from '@/lib/storefront/contact'
import { DEFAULT_STORE_ADDRESS } from '@/lib/storefront/defaults'

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function ContactExtras() {
  const settings = useStorefrontSettings()
  const phone = resolveSupportPhone(settings)
  const email =
    settings.store.email?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
    'support@splaro.co'
  const address = settings.store.address?.trim() || DEFAULT_STORE_ADDRESS
  const whatsappNumber = resolveWhatsAppNumber(settings)
  const whatsappLink = whatsAppHref(whatsappNumber)

  const hasPhone = digitsOnly(phone).length >= 10
  const hasWhatsApp = digitsOnly(whatsappNumber).length >= 10

  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [error, setError] = useState('')

  const contactCards = useMemo(
    () =>
      [
        hasPhone
          ? {
              key: 'phone',
              href: `tel:${digitsOnly(phone)}`,
              external: false,
              icon: Phone,
              label: 'Phone',
              value: phone,
            }
          : null,
        {
          key: 'email',
          href: `mailto:${email}`,
          external: false,
          icon: Mail,
          label: 'Email',
          value: email,
        },
        hasWhatsApp
          ? {
              key: 'whatsapp',
              href: whatsappLink,
              external: true,
              icon: MessageCircle,
              label: 'WhatsApp',
              value: 'Chat with us',
            }
          : null,
        {
          key: 'studio',
          href: '/stores',
          external: false,
          icon: MapPin,
          label: 'Studio',
          value: address,
        },
      ].filter(Boolean) as Array<{
        key: string
        href?: string
        external?: boolean
        icon: typeof Phone
        label: string
        value: string
        static?: boolean
      }>,
    [address, email, hasPhone, hasWhatsApp, phone, whatsappLink],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)

    setStatus('loading')
    setError('')

    try {
      await submitContactForm({
        name: String(data.get('name') ?? '').trim(),
        contact: String(data.get('contact') ?? '').trim(),
        subject: String(data.get('subject') ?? '').trim(),
        message: String(data.get('message') ?? '').trim(),
      })
      setStatus('success')
      form.reset()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Could not send your message right now.')
    }
  }

  return (
    <>
      <div className="content-page__contact-grid">
        {contactCards.map((card) => {
          const Icon = card.icon
          const inner = (
            <>
              <span className="content-page__contact-icon" aria-hidden>
                <Icon className="h-4 w-4" strokeWidth={2.1} />
              </span>
              <div className="content-page__contact-copy">
                <strong>{card.label}</strong>
                <span>{card.value}</span>
              </div>
            </>
          )

          if (card.static || !card.href) {
            return (
              <div
                key={card.key}
                className="content-page__contact-card content-page__contact-card--static"
              >
                {inner}
              </div>
            )
          }

          if (card.external) {
            return (
              <MotionAnchor
                key={card.key}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className="content-page__contact-card"
                variant="subtle"
              >
                {inner}
              </MotionAnchor>
            )
          }

          return (
            <MotionAnchor
              key={card.key}
              href={card.href!}
              className="content-page__contact-card"
              variant="subtle"
            >
              {inner}
            </MotionAnchor>
          )
        })}
      </div>

      <p className="content-page__contact-hint">
        Urgent order help?{' '}
        <Link href="/track-order">Track your order</Link>
        {hasWhatsApp ? (
          <>
            {' '}
            or{' '}
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              WhatsApp us
            </a>
          </>
        ) : null}
        .
      </p>

      <form className="content-page__form" onSubmit={handleSubmit} noValidate>
        <h2 className="content-page__section-title">Send us a message</h2>
        <p className="content-page__form-lead">
          We reply within 4 business hours. Your message goes directly to the SPLARO support team.
        </p>

        <div className="content-page__form-grid">
          <label className="content-page__field">
            <span>Full name</span>
            <input
              required
              name="name"
              minLength={2}
              className="content-page__input"
              placeholder="Your name"
              disabled={status === 'loading'}
              autoComplete="name"
            />
          </label>
          <label className="content-page__field">
            <span>Email or phone</span>
            <input
              required
              name="contact"
              className="content-page__input"
              placeholder="you@example.com or 01XXXXXXXXX"
              disabled={status === 'loading'}
              autoComplete="email"
            />
          </label>
          <label className="content-page__field content-page__field--full">
            <span>Subject</span>
            <input
              required
              name="subject"
              className="content-page__input"
              placeholder="Order, sizing, returns..."
              disabled={status === 'loading'}
            />
          </label>
          <label className="content-page__field content-page__field--full">
            <span>Message</span>
            <textarea
              required
              name="message"
              minLength={10}
              rows={5}
              className="content-page__input content-page__input--area"
              placeholder="How can we help?"
              disabled={status === 'loading'}
            />
          </label>
        </div>

        {status === 'success' ? (
          <p className="content-page__form-success" role="status">
            Thank you — our team received your message and will reply soon.
            {hasWhatsApp ? (
              <>
                {' '}
                For urgent orders,{' '}
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  WhatsApp us
                </a>
                .
              </>
            ) : null}
          </p>
        ) : (
          <MotionPressable
            type="submit"
            className="content-page__submit"
            disabled={status === 'loading'}
            variant="cta"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" strokeWidth={2.1} />
                Send message
              </>
            )}
          </MotionPressable>
        )}

        {status === 'error' && error ? (
          <p className="content-page__form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </>
  )
}

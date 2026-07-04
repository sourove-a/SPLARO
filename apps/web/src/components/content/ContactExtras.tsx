'use client'

import { type FormEvent, useState } from 'react'
import Link from 'next/link'
import { Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react'

import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { resolveWhatsAppNumber, resolveSupportPhone, whatsAppHref } from '@/lib/storefront/contact'

export function ContactExtras() {
  const settings = useStorefrontSettings()
  const phone = resolveSupportPhone(settings)
  const email = settings.store.email?.trim() || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@splaro.co'
  const whatsappHref = whatsAppHref(resolveWhatsAppNumber(settings))
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <>
      <div className="content-page__contact-grid">
        <a href={`tel:${phone.replace(/\s/g, '')}`} className="content-page__contact-card">
          <Phone className="h-4 w-4" strokeWidth={2.1} />
          <div>
            <strong>Phone</strong>
            <span>{phone}</span>
          </div>
        </a>
        <a href={`mailto:${email}`} className="content-page__contact-card">
          <Mail className="h-4 w-4" strokeWidth={2.1} />
          <div>
            <strong>Email</strong>
            <span>{email}</span>
          </div>
        </a>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="content-page__contact-card"
        >
          <MessageCircle className="h-4 w-4" strokeWidth={2.1} />
          <div>
            <strong>WhatsApp</strong>
            <span>Chat with us</span>
          </div>
        </a>
        <div className="content-page__contact-card content-page__contact-card--static">
          <MapPin className="h-4 w-4" strokeWidth={2.1} />
          <div>
            <strong>Studio</strong>
            <span>Sector 13, Road 12, Uttara, Dhaka 1230</span>
          </div>
        </div>
      </div>

      <form className="content-page__form" onSubmit={handleSubmit}>
        <h2 className="content-page__section-title">Send us a message</h2>
        <div className="content-page__form-grid">
          <label className="content-page__field">
            <span>Full name</span>
            <input required name="name" className="content-page__input" placeholder="Your name" />
          </label>
          <label className="content-page__field">
            <span>Email or phone</span>
            <input required name="contact" className="content-page__input" placeholder="you@example.com" />
          </label>
          <label className="content-page__field content-page__field--full">
            <span>Subject</span>
            <input required name="subject" className="content-page__input" placeholder="Order, sizing, returns..." />
          </label>
          <label className="content-page__field content-page__field--full">
            <span>Message</span>
            <textarea
              required
              name="message"
              rows={4}
              className="content-page__input content-page__input--area"
              placeholder="How can we help?"
            />
          </label>
        </div>
        {submitted ? (
          <p className="content-page__form-success">
            Thank you — our team will reply within 4 business hours. For urgent orders,{' '}
            <Link href={whatsappHref}>WhatsApp us</Link>.
          </p>
        ) : (
          <button type="submit" className="content-page__submit">
            <Send className="h-4 w-4" strokeWidth={2.1} />
            Send message
          </button>
        )}
      </form>
    </>
  )
}

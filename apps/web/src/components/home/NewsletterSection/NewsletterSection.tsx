'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Loader2, Mail, Send } from 'lucide-react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { useClientMounted } from '@/hooks/useClientMounted'
import { subscribeNewsletter } from '@/lib/api/newsletter'
import type { NewsletterConfig } from '@/lib/storefront/settings'

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.72, delay, ease: [0.16, 1, 0.3, 1] },
  }),
}

function resolveNewsletter(config: NewsletterConfig | undefined): NewsletterConfig {
  return {
    enabled: config?.enabled ?? true,
    eyebrow: config?.eyebrow?.trim() || 'Stay connected',
    title: config?.title?.trim() || 'Be the first to know.',
    subtitle:
      config?.subtitle?.trim() ||
      'New drops, exclusive offers & styling inspiration — straight to your inbox.',
    placeholder: config?.placeholder?.trim() || 'Your email address',
    buttonLabel: config?.buttonLabel?.trim() || 'Subscribe',
    note: config?.note?.trim() || 'No spam. Unsubscribe anytime.',
    perks:
      config?.perks?.filter(Boolean).length
        ? config!.perks.filter(Boolean)
        : ['Early access to drops', 'Member-only offers', 'Style notes & care tips'],
  }
}

export function NewsletterSection() {
  const settings = useStorefrontSettings()
  const newsletter = resolveNewsletter(settings.config.newsletter)
  const clientReady = useClientMounted()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  if (!newsletter.enabled) return null

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('loading')
    setError('')

    try {
      await subscribeNewsletter(email.trim())
      setStatus('success')
      setEmail('')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Could not subscribe right now.')
    }
  }

  return (
    <section className="ed-newsletter" aria-labelledby="newsletter-heading">
      <div className="ed-newsletter__grid" aria-hidden="true">
        <span className="ed-newsletter__orb ed-newsletter__orb--left" />
        <span className="ed-newsletter__orb ed-newsletter__orb--right" />
      </div>

      <motion.div
        className="ed-newsletter__inner"
        variants={fadeUp}
        custom={0}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
      >
        <span className="ed-newsletter__eyebrow">{newsletter.eyebrow}</span>
        <h2 id="newsletter-heading" className="ed-newsletter__title">
          {newsletter.title}
        </h2>
        <p className="ed-newsletter__sub">{newsletter.subtitle}</p>

        <div className="ed-newsletter__shell">
          {status === 'success' ? (
            <div className="ed-newsletter__success" role="status">
              <span className="ed-newsletter__success-icon">
                <Check strokeWidth={2.4} />
              </span>
              <div>
                <p className="ed-newsletter__success-title">You&apos;re on the list.</p>
                <p className="ed-newsletter__success-copy">Watch your inbox for the next SPLARO drop.</p>
              </div>
            </div>
          ) : (
            <form className="ed-newsletter__form" onSubmit={onSubmit}>
              <div className="ed-newsletter__field" suppressHydrationWarning>
                <Mail className="ed-newsletter__icon" strokeWidth={1.7} />
                {clientReady ? (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (status === 'error') setStatus('idle')
                    }}
                    placeholder={newsletter.placeholder}
                    className="ed-newsletter__input"
                    required
                    autoComplete="email"
                    disabled={status === 'loading'}
                  />
                ) : (
                  <div className="ed-newsletter__input" aria-hidden />
                )}
              </div>
              <button type="submit" className="ed-newsletter__btn" disabled={status === 'loading'}>
                {status === 'loading' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Joining…
                  </>
                ) : (
                  <>
                    {newsletter.buttonLabel}
                    <Send className="h-3.5 w-3.5" strokeWidth={2} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {status === 'error' && error ? (
          <p className="ed-newsletter__error" role="alert">
            {error}
          </p>
        ) : null}

        <p className="ed-newsletter__note">{newsletter.note}</p>
      </motion.div>
    </section>
  )
}

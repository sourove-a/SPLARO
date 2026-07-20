'use client'

import { useState } from 'react'
import { Check, Loader2, Mail, Send } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { useClientMounted } from '@/hooks/useClientMounted'
import { subscribeNewsletter } from '@/lib/api/newsletter'
import type { NewsletterConfig } from '@/lib/storefront/settings'

import { MICRO } from '@/lib/motion/config'

function resolveNewsletter(config: NewsletterConfig | undefined): NewsletterConfig {
  return {
    enabled: config?.enabled ?? true,
    eyebrow: config?.eyebrow?.trim() || 'Newsletter',
    title: config?.title?.trim() || 'Be the first to know.',
    subtitle: config?.subtitle?.trim() || '',
    placeholder: config?.placeholder?.trim() || 'Email address',
    buttonLabel: config?.buttonLabel?.trim() || 'Subscribe',
    note: config?.note?.trim() || '',
    perks: config?.perks?.filter(Boolean).length ? config!.perks.filter(Boolean) : [],
  }
}

export function NewsletterSection() {
  const settings = useStorefrontSettings()
  const newsletter = resolveNewsletter(settings.config.newsletter)
  const clientReady = useClientMounted()
  const reduceMotion = useReducedMotion()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [focused, setFocused] = useState(false)

  if (!newsletter.enabled) return null

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setStatus('error')
      setError('Please enter your email address.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('error')
      setError('Enter a valid email address.')
      return
    }

    setStatus('loading')
    setError('')

    try {
      await subscribeNewsletter(trimmed)
      setStatus('success')
      setEmail('')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Could not subscribe right now.')
    }
  }

  const fade = reduceMotion ? { duration: 0 } : MICRO

  return (
    <section className="ed-newsletter" aria-labelledby="newsletter-heading">
      <div className="ed-newsletter__grid" aria-hidden="true">
        <span className="ed-newsletter__orb ed-newsletter__orb--left" />
        <span className="ed-newsletter__orb ed-newsletter__orb--right" />
      </div>
      <div className="ed-newsletter__ambient" aria-hidden />

      <div className="ed-newsletter__inner">
        <span className="ed-newsletter__eyebrow">{newsletter.eyebrow}</span>

        <h2 id="newsletter-heading" className="ed-newsletter__title">
          {newsletter.title}
        </h2>

        <div className="ed-newsletter__shell" data-focused={focused ? 'true' : 'false'}>
          <div className="ed-newsletter__shell-sheen" aria-hidden />
          <div className="ed-newsletter__shell-shine" aria-hidden />
          <div className="ed-newsletter__shell-sweep" aria-hidden />
          <div className="ed-newsletter__shell-rim" aria-hidden />

          <AnimatePresence mode="wait" initial={false}>
            {status === 'success' ? (
              <motion.div
                key="success"
                className="ed-newsletter__success"
                role="status"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                {...(reduceMotion ? {} : { exit: { opacity: 0, scale: 0.98 } })}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 420, damping: 30 }
                }
              >
                <span className="ed-newsletter__success-icon">
                  <Check strokeWidth={2.4} />
                </span>
                <p className="ed-newsletter__success-title">You&apos;re on the list.</p>
              </motion.div>
            ) : (
              <form key="form" className="ed-newsletter__form" onSubmit={onSubmit} noValidate>
                <div className="ed-newsletter__field" suppressHydrationWarning>
                  <Mail className="ed-newsletter__icon" strokeWidth={1.7} />
                  {clientReady ? (
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (status === 'error') {
                          setStatus('idle')
                          setError('')
                        }
                      }}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      placeholder={newsletter.placeholder}
                      className="ed-newsletter__input"
                      autoComplete="email"
                      name="email"
                      inputMode="email"
                      enterKeyHint="send"
                      aria-invalid={status === 'error'}
                      aria-describedby={status === 'error' && error ? 'newsletter-error' : undefined}
                      disabled={status === 'loading'}
                    />
                  ) : (
                    <div
                      className="ed-newsletter__input ed-newsletter__input--placeholder"
                      aria-hidden
                    />
                  )}
                </div>

                <button
                  type="submit"
                  className="ed-newsletter__btn"
                  disabled={status === 'loading'}
                  aria-label={
                    status === 'loading'
                      ? 'Joining the SPLARO newsletter'
                      : `${newsletter.buttonLabel} to the SPLARO newsletter`
                  }
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="ed-newsletter__btn-text">Joining</span>
                    </>
                  ) : (
                    <>
                      <span className="ed-newsletter__btn-text">{newsletter.buttonLabel}</span>
                      <Send className="h-3.5 w-3.5" strokeWidth={2} />
                    </>
                  )}
                </button>
              </form>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {status === 'error' && error ? (
            <motion.p
              id="newsletter-error"
              className="ed-newsletter__error"
              role="alert"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              {...(reduceMotion ? {} : { exit: { opacity: 0, y: 4 } })}
              transition={fade}
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  )
}

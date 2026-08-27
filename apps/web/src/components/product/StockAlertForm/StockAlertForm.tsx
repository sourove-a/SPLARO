'use client'

import { useState } from 'react'

interface StockAlertFormProps {
  productId: string
  /** Set when a specific size/colour is out of stock, omitted for the whole product. */
  variantId?: string
  /** Prefilled when the shopper is signed in. */
  defaultEmail?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * "Tell me when it's back." Shown in place of a dead Add to Bag — an
 * out-of-stock page is otherwise a visit the shop loses with nothing to show
 * for it. Guests can use it; no sign-in.
 */
export function StockAlertForm({ productId, variantId, defaultEmail }: StockAlertFormProps) {
  const [contact, setContact] = useState(defaultEmail ?? '')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  const looksLikeEmail = contact.includes('@')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (state === 'sending') return

    const value = contact.trim()
    if (!value) {
      setError('Enter your email or mobile number')
      return
    }
    if (looksLikeEmail && !EMAIL_PATTERN.test(value)) {
      setError('That email address does not look right')
      return
    }

    setState('sending')
    setError(null)
    try {
      const response = await fetch('/api/stock-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          ...(variantId ? { variantId } : {}),
          ...(looksLikeEmail ? { email: value } : { phone: value }),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? 'Could not set up the alert — try again')
        setState('idle')
        return
      }
      setState('done')
    } catch {
      setError('Could not reach us — check your connection and try again')
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <p className="pp-stockalert__done" role="status">
        Done — we&apos;ll let you know the moment it&apos;s back.
      </p>
    )
  }

  return (
    <form className="pp-stockalert" onSubmit={submit} noValidate>
      <label className="pp-stockalert__label" htmlFor="stock-alert-contact">
        Tell me when it&apos;s back
      </label>
      <div className="pp-stockalert__row">
        <input
          id="stock-alert-contact"
          className="pp-stockalert__input"
          type="text"
          inputMode="email"
          autoComplete="email"
          placeholder="Email or 01XXXXXXXXX"
          value={contact}
          onChange={(event) => {
            setContact(event.target.value)
            if (error) setError(null)
          }}
          disabled={state === 'sending'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'stock-alert-error' : undefined}
        />
        <button className="pp-stockalert__button" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Saving…' : 'Notify me'}
        </button>
      </div>
      {error ? (
        <p className="pp-stockalert__error" id="stock-alert-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="pp-stockalert__hint">
          One message about this item only. Nothing else, ever.
        </p>
      )}
    </form>
  )
}

export default StockAlertForm

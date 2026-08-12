'use client'

import { type FormEvent, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

/** Kept in one place so the admin list and the form speak the same language. */
const INDUSTRIES = [
  'Retail shop',
  'Boutique',
  'Distributor / Wholesaler',
  'Importer / Exporter',
  'Online seller',
  'Corporate / Uniform buyer',
  'Other',
] as const

const QUANTITIES = [
  'Under 100 pcs / month',
  '100 – 500 pcs / month',
  '500 – 1,000 pcs / month',
  '1,000 – 5,000 pcs / month',
  '5,000+ pcs / month',
] as const

interface FormState {
  fullName: string
  companyName: string
  industry: string
  country: string
  phone: string
  email: string
  productInterest: string
  monthlyQuantity: string
  message: string
}

const EMPTY: FormState = {
  fullName: '',
  companyName: '',
  industry: '',
  country: 'Bangladesh',
  phone: '',
  email: '',
  productInterest: '',
  monthlyQuantity: '',
  message: '',
}

export function WholesaleForm() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const set = (key: keyof FormState) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/wholesale-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sourcePath: typeof window !== 'undefined' ? window.location.pathname : '/wholesale',
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Could not send your enquiry. Please try again.')
        return
      }

      setSent(true)
      setForm(EMPTY)
    } catch {
      setError('Network error — please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="wholesale-form__done" role="status">
        <span className="wholesale-form__done-icon" aria-hidden="true">
          <Check className="h-5 w-5" strokeWidth={2.4} />
        </span>
        <h2 className="wholesale-form__done-title">Enquiry received</h2>
        <p className="wholesale-form__done-text">
          Our wholesale team will contact you on the number you shared. For anything urgent,
          message us on WhatsApp.
        </p>
        <button type="button" className="wholesale-form__reset" onClick={() => setSent(false)}>
          Send another enquiry
        </button>
      </div>
    )
  }

  return (
    <form className="wholesale-form" onSubmit={handleSubmit} noValidate={false}>
      <div className="wholesale-form__grid">
        <label className="wholesale-field">
          <span className="wholesale-field__label">
            Your name <span aria-hidden="true">*</span>
          </span>
          <input
            required
            type="text"
            autoComplete="name"
            value={form.fullName}
            onChange={(event) => set('fullName')(event.target.value)}
            className="wholesale-field__input"
            placeholder="Full name"
            maxLength={120}
          />
        </label>

        <label className="wholesale-field">
          <span className="wholesale-field__label">Company / shop name</span>
          <input
            type="text"
            autoComplete="organization"
            value={form.companyName}
            onChange={(event) => set('companyName')(event.target.value)}
            className="wholesale-field__input"
            placeholder="Business name"
            maxLength={160}
          />
        </label>

        <label className="wholesale-field">
          <span className="wholesale-field__label">
            Business type <span aria-hidden="true">*</span>
          </span>
          <select
            required
            value={form.industry}
            onChange={(event) => set('industry')(event.target.value)}
            className="wholesale-field__input wholesale-field__select"
          >
            <option value="">Select business type</option>
            {INDUSTRIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="wholesale-field">
          <span className="wholesale-field__label">
            Country <span aria-hidden="true">*</span>
          </span>
          <input
            required
            type="text"
            autoComplete="country-name"
            value={form.country}
            onChange={(event) => set('country')(event.target.value)}
            className="wholesale-field__input"
            placeholder="Country"
            maxLength={80}
          />
        </label>

        <label className="wholesale-field">
          <span className="wholesale-field__label">
            Phone / WhatsApp <span aria-hidden="true">*</span>
          </span>
          <input
            required
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => set('phone')(event.target.value)}
            className="wholesale-field__input"
            placeholder="01XXXXXXXXX or +country code"
            maxLength={32}
          />
        </label>

        <label className="wholesale-field">
          <span className="wholesale-field__label">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => set('email')(event.target.value)}
            className="wholesale-field__input"
            placeholder="name@company.com"
            maxLength={160}
          />
        </label>

        <label className="wholesale-field">
          <span className="wholesale-field__label">Products you need</span>
          <input
            type="text"
            value={form.productInterest}
            onChange={(event) => set('productInterest')(event.target.value)}
            className="wholesale-field__input"
            placeholder="e.g. Panjabi, Kurti, Footwear"
            maxLength={200}
          />
        </label>

        <label className="wholesale-field">
          <span className="wholesale-field__label">Monthly quantity</span>
          <select
            value={form.monthlyQuantity}
            onChange={(event) => set('monthlyQuantity')(event.target.value)}
            className="wholesale-field__input wholesale-field__select"
          >
            <option value="">Select a range</option>
            {QUANTITIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="wholesale-field wholesale-field--full">
        <span className="wholesale-field__label">Message</span>
        <textarea
          value={form.message}
          onChange={(event) => set('message')(event.target.value)}
          className="wholesale-field__input wholesale-field__textarea"
          placeholder="Tell us about your business, target market, and timeline."
          rows={4}
          maxLength={2000}
        />
      </label>

      {error ? (
        <p className="wholesale-form__error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="wholesale-form__submit" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 wholesale-form__spinner" strokeWidth={2.4} /> : null}
        {loading ? 'Sending…' : 'Send wholesale enquiry'}
      </button>

      <p className="wholesale-form__note">
        We reply to serious buyers within one business day. Your details are never shared.
      </p>
    </form>
  )
}

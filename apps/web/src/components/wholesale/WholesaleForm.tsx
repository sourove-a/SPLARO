'use client'

import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import { Check, ImagePlus, Loader2, X } from 'lucide-react'

/** Kept in one place so the admin list and the form speak the same language. */
const INDUSTRIES = [
  'Retail store',
  'Multi-brand boutique',
  'Distributor / Wholesaler',
  'Importer / Exporter',
  'Online retailer',
  'Department store',
  'Corporate buyer',
  'Other',
] as const

/** Assortment categories — mirrors how international fashion B2B forms ask. */
const CATEGORIES = [
  'Women’s apparel',
  'Men’s apparel',
  'Kidswear',
  'Footwear',
  'Accessories',
  'Full assortment',
  'Mixed / custom selection',
] as const

/** Order volume bands — clearer than vague “monthly” for wholesale quoting. */
const QUANTITIES = [
  'Sample / trial (under 50 pcs)',
  '50 – 200 pcs per order',
  '200 – 500 pcs per order',
  '500 – 2,000 pcs per order',
  '2,000 – 10,000 pcs per order',
  '10,000+ pcs per order',
] as const

const MAX_IMAGES = 4

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
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (key: keyof FormState) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const uploadImages = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, MAX_IMAGES - imageUrls.length)
    if (list.length === 0) return

    setError('')
    setUploading(true)
    try {
      const body = new FormData()
      for (const file of list) body.append('images', file)
      const response = await fetch('/api/wholesale-inquiry/images', {
        method: 'POST',
        body,
      })
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        urls?: string[]
        error?: string
      }
      if (!response.ok || !payload.ok || !payload.urls?.length) {
        setError(payload.error ?? 'Could not upload images. Try JPG or PNG under 4 MB.')
        return
      }
      setImageUrls((current) => [...current, ...payload.urls!].slice(0, MAX_IMAGES))
    } catch {
      setError('Network error while uploading images.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onPickImages = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) void uploadImages(event.target.files)
  }

  const removeImage = (url: string) => {
    setImageUrls((current) => current.filter((item) => item !== url))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading || uploading) return

    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/wholesale-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          imageUrls,
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
      setImageUrls([])
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
            Contact name <span aria-hidden="true">*</span>
          </span>
          <input
            required
            type="text"
            autoComplete="name"
            value={form.fullName}
            onChange={(event) => set('fullName')(event.target.value)}
            className="wholesale-field__input"
            placeholder="Your full name"
            maxLength={120}
          />
        </label>

        <label className="wholesale-field">
          <span className="wholesale-field__label">Company name</span>
          <input
            type="text"
            autoComplete="organization"
            value={form.companyName}
            onChange={(event) => set('companyName')(event.target.value)}
            className="wholesale-field__input"
            placeholder="Registered business name"
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
            <option value="">Select type</option>
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
            placeholder="Country of operation"
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
            placeholder="+880 … or local mobile"
            maxLength={32}
          />
        </label>

        <label className="wholesale-field">
          <span className="wholesale-field__label">Business email</span>
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => set('email')(event.target.value)}
            className="wholesale-field__input"
            placeholder="buying@company.com"
            maxLength={160}
          />
        </label>

        <label className="wholesale-field">
          <span className="wholesale-field__label">Categories of interest</span>
          <select
            value={form.productInterest}
            onChange={(event) => set('productInterest')(event.target.value)}
            className="wholesale-field__input wholesale-field__select"
          >
            <option value="">Select categories</option>
            {CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="wholesale-field">
          <span className="wholesale-field__label">Estimated order volume</span>
          <select
            value={form.monthlyQuantity}
            onChange={(event) => set('monthlyQuantity')(event.target.value)}
            className="wholesale-field__input wholesale-field__select"
          >
            <option value="">Select volume</option>
            {QUANTITIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="wholesale-field wholesale-field--full">
        <span className="wholesale-field__label">Reference photos</span>
        <p className="wholesale-field__hint">
          Optional — up to {MAX_IMAGES} style references (JPG, PNG or WebP).
        </p>

        <div className="wholesale-photos">
          {imageUrls.map((url) => (
            <div key={url} className="wholesale-photos__item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="wholesale-photos__img" />
              <button
                type="button"
                className="wholesale-photos__remove"
                aria-label="Remove photo"
                onClick={() => removeImage(url)}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            </div>
          ))}

          {imageUrls.length < MAX_IMAGES ? (
            <button
              type="button"
              className="wholesale-photos__add"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 wholesale-form__spinner" strokeWidth={2} />
              ) : (
                <ImagePlus className="h-5 w-5" strokeWidth={1.7} />
              )}
              <span>{uploading ? 'Uploading…' : 'Add photo'}</span>
            </button>
          ) : null}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={onPickImages}
        />
      </div>

      <label className="wholesale-field wholesale-field--full">
        <span className="wholesale-field__label">Additional details</span>
        <textarea
          value={form.message}
          onChange={(event) => set('message')(event.target.value)}
          className="wholesale-field__input wholesale-field__textarea"
          placeholder="Target market, delivery timeline, branding needs, or catalogue request."
          rows={4}
          maxLength={2000}
        />
      </label>

      {error ? (
        <p className="wholesale-form__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="wholesale-form__actions">
        <button type="submit" className="wholesale-form__submit" disabled={loading || uploading}>
          {loading ? <Loader2 className="h-4 w-4 wholesale-form__spinner" strokeWidth={2.4} /> : null}
          {loading ? 'Sending…' : 'Submit enquiry'}
        </button>
        <p className="wholesale-form__note">
          Serious buyers hear back within one business day. Your details stay private.
        </p>
      </div>
    </form>
  )
}

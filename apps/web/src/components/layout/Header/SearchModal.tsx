'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'
import { requestScrollTopOnOverlayUnlock } from '@/lib/navigation/overlay-unlock-scroll'
import { snapDocumentScrollToTop } from '@/lib/navigation/snap-scroll-top'
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock'
import { cn } from '@/lib/utils/cn'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  /** desktop = expand beside nav; mobile = full header row */
  variant?: 'mobile' | 'desktop'
}

type SuggestProduct = { id: string; name: string; slug: string }

/** Inline header search — no full-screen modal / trending chrome. */
export function SearchModal({ isOpen, onClose, variant = 'mobile' }: SearchModalProps) {
  const router = useRouter()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [suggestProducts, setSuggestProducts] = useState<SuggestProduct[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  /** Avoid the opening click/pointerup landing on the full-screen dismiss layer. */
  const [dismissArmed, setDismissArmed] = useState(false)
  const isDesktop = variant === 'desktop'
  // Desktop inline search must not body-pin — fixed header jumped like a dropdown.
  useOverlayScrollLock(isOpen && !isDesktop)

  useEffect(() => {
    if (!isOpen) {
      setDismissArmed(false)
      return
    }
    const arm = window.setTimeout(() => setDismissArmed(true), 320)
    return () => window.clearTimeout(arm)
  }, [isOpen])

  useLayoutEffect(() => {
    if (!isOpen) {
      setQuery('')
      setSuggestProducts([])
      setSuggestLoading(false)
      return
    }
    // Never autoFocus — browser scroll-into-view fights scroll-lock and jerks the header.
    const focusInput = () => inputRef.current?.focus({ preventScroll: true })
    focusInput()
    const raf = requestAnimationFrame(focusInput)
    const t = window.setTimeout(focusInput, 120)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const q = query.trim()
    if (q.length < 2) {
      setSuggestProducts([])
      setSuggestLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setSuggestLoading(true)
    const debounce = window.setTimeout(() => {
      void fetch(`/api/search/suggest?q=${encodeURIComponent(q)}&limit=6`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((payload: { products?: SuggestProduct[] } | null) => {
          if (cancelled || !payload) return
          setSuggestProducts(payload.products ?? [])
        })
        .catch(() => {
          if (!cancelled) setSuggestProducts([])
        })
        .finally(() => {
          if (!cancelled) setSuggestLoading(false)
        })
    }, 200)

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(debounce)
    }
  }, [isOpen, query])

  function goSearch(term: string) {
    const q = term.trim()
    if (!q) return
    requestScrollTopOnOverlayUnlock()
    safeClientNavigate(router, `/search?q=${encodeURIComponent(q)}`)
    onClose()
    snapDocumentScrollToTop()
  }

  function goProduct(slug: string) {
    requestScrollTopOnOverlayUnlock()
    onClose()
    safeClientNavigate(router, `/products/${slug}`)
    snapDocumentScrollToTop()
  }

  if (!isOpen) return null

  const trimmed = query.trim()
  const showPanel = trimmed.length >= 2

  return (
    <>
      {dismissArmed ? (
        <button
          type="button"
          className="site-header-search__dismiss"
          aria-label="Close search"
          tabIndex={-1}
          onClick={onClose}
        />
      ) : null}

      <div
        className={cn(
          'site-header-search',
          isDesktop ? 'site-header-search--desktop' : 'site-header-search--mobile',
        )}
        role="search"
        data-lenis-prevent
      >
        <div className="site-header-search__row">
          <label className="site-header-search__field">
            <span className="site-header-search__field-shine" aria-hidden />
            <Search className="site-header-search__icon" strokeWidth={1.4} aria-hidden />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              role="searchbox"
              name="splaro-header-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SPLARO"
              className="site-header-search__input"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
              aria-autocomplete="list"
              aria-controls={showPanel ? listId : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  goSearch(query)
                }
              }}
            />
            {query ? (
              <button
                type="button"
                className="site-header-search__clear"
                aria-label="Clear"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus({ preventScroll: true })
                }}
              >
                <X strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
          </label>

          <button
            type="button"
            className="site-header-search__close"
            aria-label="Close search"
            onClick={onClose}
          >
            <X strokeWidth={1.45} aria-hidden />
          </button>
        </div>

        {showPanel ? (
          <div
            id={listId}
            className="site-header-search__panel"
            role="listbox"
            aria-label="Suggestions"
            data-lenis-prevent
          >
            <button
              type="button"
              className="site-header-search__go"
              onClick={() => goSearch(trimmed)}
            >
              <Search strokeWidth={1.5} aria-hidden />
              <span>
                Search for <strong>&ldquo;{trimmed}&rdquo;</strong>
              </span>
            </button>

            {suggestProducts.length > 0 ? (
              <ul className="site-header-search__list">
                {suggestProducts.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/products/${product.slug}`}
                      scroll={false}
                      className="site-header-search__item"
                      role="option"
                      onClick={(event) => {
                        event.preventDefault()
                        goProduct(product.slug)
                      }}
                    >
                      {product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : suggestLoading ? (
              <p className="site-header-search__hint" aria-live="polite">
                Searching…
              </p>
            ) : (
              <p className="site-header-search__hint">No matching products</p>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}

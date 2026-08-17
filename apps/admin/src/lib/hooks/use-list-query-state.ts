'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'

/**
 * Filter, search and page state for an admin list, mirrored into the URL.
 *
 * The list screens used to read `?status=` and `?search=` once on mount and
 * never write anything back. So a filtered view could be linked *to* but never
 * linked *from*: an operator who filtered to Pending and hit reload landed back
 * on All, and could not paste "the screen I am looking at" into Telegram.
 *
 * The URL is rewritten with `replaceState` rather than the router, which is the
 * pattern the products screen already used for its view toggle. It keeps the
 * address bar truthful without pushing an RSC navigation on every keystroke —
 * at the cost of Back not stepping through individual filter changes, which is
 * the right trade for a control strip people click many times a second.
 */

export interface ListQueryState<F extends Record<string, string>> {
  /** Committed filter values. Changing any of them resets to page 1. */
  filters: F
  setFilter: (key: keyof F, value: string) => void
  /** Raw input value — bind this to the search box. */
  search: string
  setSearch: (value: string) => void
  /** Settled search, safe to put in a query key. */
  debouncedSearch: string
  page: number
  setPage: (page: number) => void
  /** True when anything is narrowing the list. Drives the "clear" affordance. */
  isFiltered: boolean
  clear: () => void
}

export function useListQueryState<F extends Record<string, string>>(
  defaults: F,
  options: { searchKey?: string; debounceMs?: number } = {},
): ListQueryState<F> {
  const searchKey = options.searchKey ?? 'search'
  const defaultsRef = useRef(defaults)

  const readUrl = useCallback((): { filters: F; search: string; page: number } => {
    if (typeof window === 'undefined') {
      return { filters: defaultsRef.current, search: '', page: 1 }
    }
    const params = new URLSearchParams(window.location.search)
    const filters = { ...defaultsRef.current }
    for (const key of Object.keys(defaultsRef.current) as Array<keyof F>) {
      const raw = params.get(String(key))
      // A value the screen does not recognise is ignored rather than trusted —
      // the URL is user-editable, and an unknown status would filter to nothing
      // with no way back except editing the address bar again.
      if (raw) filters[key] = raw as F[keyof F]
    }
    const page = Math.max(1, Number(params.get('page')) || 1)
    return { filters, search: params.get(searchKey) ?? '', page }
  }, [searchKey])

  const initial = useMemo(readUrl, [readUrl])
  const [filters, setFilters] = useState<F>(initial.filters)
  const [search, setSearch] = useState(initial.search)
  const [page, setPage] = useState(initial.page)
  const debouncedSearch = useDebouncedValue(search, options.debounceMs ?? 300)

  // Back/forward still land on a coherent view even though individual filter
  // clicks do not each get a history entry.
  useEffect(() => {
    const onPop = () => {
      const next = readUrl()
      setFilters(next.filters)
      setSearch(next.search)
      setPage(next.page)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [readUrl])

  // Write once the search has settled, so the address bar does not thrash while
  // somebody is still typing an order number.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== defaultsRef.current[key]) params.set(key, value)
      else params.delete(key)
    }
    if (debouncedSearch.trim()) params.set(searchKey, debouncedSearch.trim())
    else params.delete(searchKey)
    if (page > 1) params.set('page', String(page))
    else params.delete('page')

    const query = params.toString()
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, '', next)
    }
  }, [filters, debouncedSearch, page, searchKey])

  const setFilter = useCallback((key: keyof F, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    // Page 4 of "Pending" is not page 4 of "Delivered" — staying put would show
    // an empty page and read as "no results".
    setPage(1)
  }, [])

  const changeSearch = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const clear = useCallback(() => {
    setFilters(defaultsRef.current)
    setSearch('')
    setPage(1)
  }, [])

  const isFiltered =
    search.trim().length > 0 ||
    (Object.keys(defaultsRef.current) as Array<keyof F>).some(
      (key) => filters[key] !== defaultsRef.current[key],
    )

  return {
    filters,
    setFilter,
    search,
    setSearch: changeSearch,
    debouncedSearch,
    page,
    setPage,
    isFiltered,
    clear,
  }
}

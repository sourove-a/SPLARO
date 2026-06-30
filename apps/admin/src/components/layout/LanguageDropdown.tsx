'use client'

import { useState } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import toast from 'react-hot-toast'

const LANGUAGES = [
  { code: 'EN', label: 'English' },
  { code: 'BN', label: 'বাংলা' },
] as const

export function LanguageDropdown() {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState<(typeof LANGUAGES)[number]['code']>('EN')

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="admin-header-chip admin-header-chip--wide hidden sm:inline-flex"
        aria-expanded={open}
      >
        <Globe className="h-4 w-4" strokeWidth={2} />
        {lang}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close language menu" />
          <div className="admin-header-popover absolute right-0 top-[calc(100%+0.5rem)] z-50 w-36 overflow-hidden rounded-[16px] py-1">
            {LANGUAGES.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setLang(item.code)
                  setOpen(false)
                  toast.success(`Language set to ${item.label}.`)
                }}
                className={`block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--admin-surface-hover)] ${lang === item.code ? 'text-[var(--admin-text)]' : 'text-[var(--admin-text-secondary)]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

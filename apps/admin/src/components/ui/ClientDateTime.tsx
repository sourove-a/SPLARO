'use client'

import { useEffect, useState } from 'react'

interface ClientDateTimeProps {
  className?: string
  suffix?: string
}

/** Renders locale date/time only after mount — avoids SSR hydration mismatch. */
export function ClientDateTime({ className, suffix = '' }: ClientDateTimeProps) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    const format = () => {
      const now = new Date()
      const date = now.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      setLabel(`${date} · ${time}${suffix}`)
    }
    format()
    const id = window.setInterval(format, 60_000)
    return () => window.clearInterval(id)
  }, [suffix])

  return (
    <span className={className} suppressHydrationWarning>
      {label || '\u00a0'}
    </span>
  )
}

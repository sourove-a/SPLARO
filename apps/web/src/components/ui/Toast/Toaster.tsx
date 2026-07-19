'use client'

import { Toaster as HotToaster } from 'react-hot-toast'

export function Toaster() {
  return (
    <HotToaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#111111',
          color: '#ffffff',
          fontFamily: 'Inter, sans-serif',
          fontSize: '13px',
          letterSpacing: '0.02em',
          borderRadius: '0',
          padding: '14px 20px',
        },
        success: {
          style: {
            background: '#f0fdf4',
            color: '#14532d',
            border: '1px solid rgba(22, 163, 74, 0.28)',
            boxShadow: '0 12px 32px rgba(22, 101, 52, 0.14)',
          },
          iconTheme: { primary: '#16a34a', secondary: '#ffffff' },
        },
        error: {
          style: {
            background: '#fef2f2',
            color: '#7f1d1d',
            border: '1px solid rgba(220, 38, 38, 0.28)',
            boxShadow: '0 12px 32px rgba(127, 29, 29, 0.14)',
          },
          iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
        },
      }}
    />
  )
}

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
          iconTheme: { primary: '#C8A97E', secondary: '#111111' },
        },
        error: {
          iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
        },
      }}
    />
  )
}

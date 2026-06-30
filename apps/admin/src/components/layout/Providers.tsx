'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { AdminNavRecovery } from '@/components/layout/AdminNavRecovery'
import { AdminCssHealthGuard } from '@/components/layout/AdminCssHealthGuard'
import { AdminPersistHydrator } from '@/components/layout/AdminPersistHydrator'
import { ApiError } from '@/lib/api/client'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, error) => {
              if (count >= 2) return false
              if (error instanceof ApiError) {
                return error.isNetworkError || error.isServerError
              }
              return count < 1
            },
            retryDelay: (attempt) => Math.min(800 * (attempt + 1), 2400),
            refetchOnWindowFocus: process.env.NODE_ENV === 'production',
            refetchOnReconnect: true,
            throwOnError: false,
          },
          mutations: {
            throwOnError: false,
          },
        },
      }),
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="splaro-admin-theme">
      <QueryClientProvider client={queryClient}>
        <AdminPersistHydrator />
        <AdminNavRecovery />
        <AdminCssHealthGuard />
        {children}
        <Toaster
          position="top-center"
          containerClassName="admin-toast-container"
          containerStyle={{ zIndex: 99999 }}
          toastOptions={{
            duration: 3400,
            className: 'admin-toast',
            style: {
              background: 'var(--admin-toast-bg)',
              color: 'var(--admin-toast-text)',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              borderRadius: '14px',
              boxShadow: 'var(--admin-toast-shadow)',
              border: '1px solid var(--admin-toast-border)',
              padding: '12px 16px',
              maxWidth: '420px',
            },
            success: {
              className: 'admin-toast admin-toast--ok',
              iconTheme: { primary: 'var(--admin-toast-ok-icon)', secondary: 'var(--admin-toast-ok-bg)' },
            },
            error: {
              className: 'admin-toast admin-toast--fail',
              duration: 4800,
              iconTheme: { primary: 'var(--admin-toast-fail-icon)', secondary: 'var(--admin-toast-fail-bg)' },
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

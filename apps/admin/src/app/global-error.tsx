'use client'

import { AdminButton } from '@/components/ui/AdminButton'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#f5f5f7] p-6 font-sans">
        <div className="max-w-md rounded-[24px] border border-black/8 bg-white p-8 text-center shadow-lg">
          <h1 className="text-xl font-black text-[#111111]">SPLARO Admin Error</h1>
          <p className="mt-2 text-sm font-semibold text-[#6B6B6B]">{error.message}</p>
          <AdminButton variant="gold" className="mt-6" onClick={reset}>
            Reload application
          </AdminButton>
        </div>
      </body>
    </html>
  )
}

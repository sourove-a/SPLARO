import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="admin-module-icon-ring" style={{ width: 56, height: 56 }}>
        <ShieldAlert className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h1 className="text-xl font-bold text-[var(--admin-text-primary)]">Access denied</h1>
      <p className="max-w-md text-sm font-medium text-[var(--admin-text-muted)]">
        Your role does not include permission to open this section. Use the sidebar to navigate to areas
        assigned to your account.
      </p>
      <Link href="/dashboard" className="admin-btn admin-btn--primary mt-2">
        Back to dashboard
      </Link>
    </div>
  )
}

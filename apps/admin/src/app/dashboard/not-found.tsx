import Link from 'next/link'
import { AdminPageShell } from '@/components/ui/AdminPageShell'

export default function DashboardNotFound() {
  return (
    <AdminPageShell
      title="Page not found"
      description="This admin module does not exist or was moved."
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Not found' }]}
    >
      <div className="admin-module-card text-center">
        <p className="admin-module-card__text">Check the sidebar or use ⌘K to search modules.</p>
        <Link
          href="/dashboard"
          className="admin-btn admin-btn--gold mt-4 inline-flex"
        >
          Back to dashboard
        </Link>
      </div>
    </AdminPageShell>
  )
}

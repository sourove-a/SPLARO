import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { AdminTokenHydrator } from '@/components/layout/AdminTokenHydrator'
import { DashboardMain } from '@/components/layout/DashboardMain'
import { TelegramLinkBanner } from '@/components/layout/TelegramLinkBanner'
import { IntelligencePanel } from '@/components/layout/IntelligencePanelClient'
import { AgentShell } from '@/components/agent/AgentShell'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/session'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? ''

  // Defense-in-depth: middleware already gates /dashboard, but auth must not
  // depend on middleware alone (see CVE-2025-29927 middleware bypass).
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) {
    redirect('/login?next=/dashboard')
  }

  return (
    <div className="admin-shell flex h-screen w-full min-w-0 overflow-hidden">
      <AdminTokenHydrator token={token} />
      <AdminSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:pl-0 pl-12">
        <div className="pt-4">
          <AdminHeader />
        </div>
        <TelegramLinkBanner />
        <DashboardMain>{children}</DashboardMain>
      </div>
      <IntelligencePanel />
      <AgentShell />
    </div>
  )
}

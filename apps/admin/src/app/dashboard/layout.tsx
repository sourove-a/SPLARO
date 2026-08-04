import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminTokenHydrator } from '@/components/layout/AdminTokenHydrator'
import { DcAdminShell } from '@/components/layout/DcAdminShell'
import { TelegramLinkBanner } from '@/components/layout/TelegramLinkBanner'
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
    <>
      <AdminTokenHydrator token={token} />
      <DcAdminShell banner={<TelegramLinkBanner />}>
        {/*
          Server-owned page canvas. Next wraps page segments in Suspense for
          loading.tsx — wrapping that slot in a Client Component div made
          hydration see Suspense on the server and div on the client.
        */}
        <div className="dc-page-body">{children}</div>
      </DcAdminShell>
      {/* The DC shell renders its own "Ask SPLARO" launcher. */}
      <AgentShell hideFab />
    </>
  )
}

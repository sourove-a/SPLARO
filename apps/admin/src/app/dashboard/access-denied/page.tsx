'use client'

import { useRouter } from 'next/navigation'
import { DcEmptyState } from '@/components/dc/blocks/DcStates'

export default function AccessDeniedPage() {
  const router = useRouter()

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <DcEmptyState
        icon="icon-shield-alert"
        title="Access denied"
        body="Your role does not include permission to open this section. Use the sidebar to navigate to areas assigned to your account."
        cta="Back to dashboard"
        onCta={() => router.push('/dashboard')}
      />
    </div>
  )
}

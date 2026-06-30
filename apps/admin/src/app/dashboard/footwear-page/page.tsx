'use client'

import { AdminPageShell } from '@/components/ui/AdminPageShell'
import { FootwearPagePanel } from '@/components/content/FootwearPagePanel'

export default function FootwearPageAdmin() {
  return (
    <AdminPageShell
      title="Footwear Page"
      description="Control which sections appear on the public /footwear page"
      breadcrumbs={[{ label: 'Content' }, { label: 'Footwear Page' }]}
    >
      <FootwearPagePanel />
    </AdminPageShell>
  )
}

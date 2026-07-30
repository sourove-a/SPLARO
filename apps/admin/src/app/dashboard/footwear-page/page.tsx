'use client'

import { DcModuleHost } from '@/components/dc/screens/DcModuleHost'
import { FootwearPagePanel } from '@/components/content/FootwearPagePanel'
import { getNavItemByHref } from '@/lib/navigation/admin-nav'

const HREF = '/dashboard/footwear-page'

export default function FootwearPageAdmin() {
  const navItem = getNavItemByHref(HREF)
  if (!navItem) {
    return (
      <div className="dc-detail-host p-6">
        <FootwearPagePanel />
      </div>
    )
  }

  // Prefer designed live host when prototype screen key exists.
  return (
    <DcModuleHost navItem={navItem} moduleHref={HREF} title="Footwear Page" screen="footwear">
      <FootwearPagePanel />
    </DcModuleHost>
  )
}

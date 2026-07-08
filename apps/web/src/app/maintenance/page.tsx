import type { Metadata } from 'next'
import { MaintenanceScreen } from '@/components/maintenance/MaintenanceScreen'

export const metadata: Metadata = {
  title: 'Maintenance',
  description: 'SPLARO is undergoing scheduled maintenance. We will be back soon.',
  robots: { index: false, follow: false },
}

export default function MaintenancePage() {
  return <MaintenanceScreen />
}

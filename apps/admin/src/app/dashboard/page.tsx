import type { Metadata } from 'next'
import { PremiumDashboard } from '@/components/dashboard/PremiumDashboard'

export const metadata: Metadata = { title: 'Dashboard — SPLARO Admin' }

export default function DashboardPage() {
  return <PremiumDashboard />
}

import type { Metadata } from 'next'
import { DcDashboard } from '@/components/dashboard/DcDashboard'

export const metadata: Metadata = { title: 'Dashboard — SPLARO Admin' }

export default function DashboardPage() {
  return <DcDashboard />
}

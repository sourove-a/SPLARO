import { AdminTableSkeleton, AdminSkeletonGroup } from '@/components/ui/AdminUiPrimitives'

export default function DashboardLoading() {
  return (
    <div className="admin-dashboard-canvas space-y-4 py-2" aria-busy="true" aria-label="Loading dashboard">
      <AdminSkeletonGroup rows={2} className="max-w-md" />
      <AdminTableSkeleton rows={8} />
    </div>
  )
}

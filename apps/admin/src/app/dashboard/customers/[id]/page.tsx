import { AdminPageShell } from '@/components/ui/AdminPageShell'
import { CustomerProfileClient } from '@/components/customers/CustomerProfileClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerProfilePage({ params }: PageProps) {
  const { id } = await params

  return (
    <AdminPageShell
      title="Customer Profile"
      description="Full 360° customer intelligence view"
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Customers' },
        { label: 'Customers', href: '/dashboard/customers' },
        { label: id },
      ]}
    >
      <CustomerProfileClient customerId={id} />
    </AdminPageShell>
  )
}

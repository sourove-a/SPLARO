'use client'

import toast from 'react-hot-toast'
import { Customer360Profile } from '@/components/customers/Customer360Profile'
import { addCustomerNote, updateCustomerTags } from '@/lib/api/customers'
import { useBlockCustomer, useCustomer } from '@/lib/api/hooks'
import { formatRelativeTime } from '@/lib/api/orders'

export function CustomerProfileClient({ customerId }: { customerId: string }) {
  const { data, isLoading, isError, refetch } = useCustomer(customerId)
  const blockCustomer = useBlockCustomer()

  if (isLoading) {
    return (
      <div className="admin-module-card py-12 text-center text-sm text-[#6B6B6B]">
        Loading customer profile…
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="admin-module-card py-12 text-center text-sm text-amber-700">
        Customer not found or API offline — start backend on :4000
      </div>
    )
  }

  const notes = data.customerNotes?.map((note) => note.body).join('\n') || data.adminNotes || undefined

  return (
    <Customer360Profile
      customer={{
        id: data.id,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        ...(data.email ? { email: data.email } : {}),
        signupDate: data.createdAt.slice(0, 10),
        ...(data.lastOrderDate ? { lastLogin: formatRelativeTime(data.lastOrderDate) } : {}),
        totalOrders: data.totalOrders,
        totalSpent: Number(data.totalSpent),
        avgOrderValue: Number(data.avgOrderValue ?? 0),
        ...(data.lastOrderDate ? { lastOrderDate: data.lastOrderDate.slice(0, 10) } : {}),
        loyaltyPoints: data.loyaltyPoints ?? 0,
        loyaltyTier: data.loyaltyTier,
        vipScore: data.vipScore ?? 0,
        codRiskScore: data.codRiskScore,
        tags: data.tags ?? [],
        isBlocked: data.isBlocked ?? false,
        orders: data.orders ?? [],
        activityNotes: data.customerNotes ?? [],
        ...(notes ? { adminNotes: notes } : {}),
        addresses: (data.addresses ?? []).map((addr) => ({
          ...(addr.label ? { label: addr.label } : {}),
          city: addr.city,
          district: addr.district,
          division: addr.division,
        })),
      }}
      variant="light"
      onAddNote={async (note) => {
        try {
          await addCustomerNote(customerId, note)
          toast.success('Note saved.')
          void refetch()
        } catch {
          toast.error('Could not save note.')
        }
      }}
      onAddTag={async (tag) => {
        try {
          const next = [...new Set([...(data.tags ?? []), tag])]
          await updateCustomerTags(customerId, next)
          toast.success(`Tag "${tag}" added.`)
          void refetch()
        } catch {
          toast.error('Could not add tag.')
        }
      }}
      onToggleBlock={(blocked) => {
        blockCustomer.mutate(
          { id: customerId, blocked },
          {
            onSuccess: () => {
              toast.success(blocked ? 'Customer blocked.' : 'Customer unblocked.')
              void refetch()
            },
            onError: () => toast.error('Could not update block status.'),
          },
        )
      }}
    />
  )
}

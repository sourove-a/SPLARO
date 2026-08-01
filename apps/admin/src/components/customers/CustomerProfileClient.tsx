'use client'

import {
  confirmCustomerBlockUpdated,
  confirmCustomerNoteAdded,
  confirmCustomerTagsUpdated,
} from '@/lib/admin/customer-save'
import { Customer360Profile } from '@/components/customers/Customer360Profile'
import { addCustomerNote, updateCustomerTags } from '@/lib/api/customers'
import { useBlockCustomer, useCustomer } from '@/lib/api/hooks'
import { formatRelativeTime } from '@/lib/api/orders'

const CARD: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
}

export function CustomerProfileClient({ customerId }: { customerId: string }) {
  const { data, isLoading, isError, refetch } = useCustomer(customerId)
  const blockCustomer = useBlockCustomer()

  if (isLoading) {
    return (
      <div style={CARD} className="py-12 text-center text-sm text-[var(--ink-3)]">
        Loading customer profile…
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div style={CARD} className="py-12 text-center text-sm text-[var(--warn)]">
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
        ...(data.authProvider ? { authProvider: data.authProvider } : {}),
        ...(data.googleLinked ? { googleLinked: true } : {}),
        ...(data.emailVerified ? { emailVerified: true } : {}),
        ...(data.avatar ? { avatar: data.avatar } : {}),
        ...(data.lastLogin
          ? { lastLogin: formatRelativeTime(data.lastLogin) }
          : data.lastOrderDate
            ? { lastLogin: formatRelativeTime(data.lastOrderDate) }
            : {}),
        ...(data.lastDevice ? { lastDevice: data.lastDevice } : {}),
        ...(data.lastIp ? { lastIp: data.lastIp } : {}),
        ...(data.fraudSignals ? { fraudSignals: data.fraudSignals } : {}),
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
        const ok = await confirmCustomerNoteAdded(customerId, note, () =>
          addCustomerNote(customerId, note),
        )
        if (ok) void refetch()
        return ok
      }}
      onAddTag={async (tag) => {
        const trimmed = tag.trim()
        if (!trimmed) return false
        const next = [...new Set([...(data.tags ?? []), trimmed])]
        const ok = await confirmCustomerTagsUpdated(
          customerId,
          next,
          `Tag "${trimmed}" added.`,
          () => updateCustomerTags(customerId, next),
        )
        if (ok) void refetch()
        return ok
      }}
      onToggleBlock={async (blocked) => {
        const ok = await confirmCustomerBlockUpdated(customerId, blocked, () =>
          blockCustomer.mutateAsync({ id: customerId, blocked }),
        )
        if (ok) void refetch()
        return ok
      }}
    />
  )
}

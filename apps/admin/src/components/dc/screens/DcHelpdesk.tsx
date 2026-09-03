'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcField, DcModal } from '@/components/dc/DcModal'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { createSupportTicket } from '@/lib/api/admin-hub'
import { ApiError } from '@/lib/api/client'
import { replyHelpdeskTicket } from '@/lib/api/commerce-os'
import { useHelpdeskOverview } from '@/lib/api/hooks'

export function DcHelpdesk() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="helpdesk" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcHelpdeskBody />
    </DcScreenProvider>
  )
}

function DcHelpdeskBody() {
  const { toast } = useDcScreen()
  const helpdesk = useHelpdeskOverview()
  const qc = useQueryClient()

  const [statusTab, setStatusTab] = useState<'all' | 'open' | 'resolved'>('all')
  const [replyFor, setReplyFor] = useState<{ id: string; subject: string } | null>(null)
  const [message, setMessage] = useState('')

  // New ticket modal
  const [newTicketOpen, setNewTicketOpen] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newChannel, setNewChannel] = useState('WHATSAPP')
  const [newPriority, setNewPriority] = useState('MEDIUM')
  const [newMessage, setNewMessage] = useState('')

  const reply = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => replyHelpdeskTicket(id, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['helpdesk-overview'] })
    },
  })

  const createTicketMutation = useMutation({
    mutationFn: (data: { subject: string; channel?: string; priority?: string; message?: string }) =>
      createSupportTicket(data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['helpdesk-overview'] })
    },
  })

  const handleCreateTicket = async () => {
    if (!newSubject.trim()) {
      toast('warn', 'Subject required', 'Please enter a ticket subject.')
      return
    }

    try {
      const payload: { subject: string; channel?: string; priority?: string; message?: string } = {
        subject: newSubject.trim(),
        channel: newChannel,
        priority: newPriority,
      }
      if (newMessage.trim()) payload.message = newMessage.trim()

      await createTicketMutation.mutateAsync(payload)
      toast('ok', 'Ticket created', newSubject.trim())
      setNewTicketOpen(false)
      setNewSubject('')
      setNewMessage('')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Create failed'
      toast('bad', 'Ticket not created', msg)
    }
  }

  const tickets = helpdesk.data?.tickets
  const filteredTickets = useMemo(() => {
    const list = tickets ?? []
    if (statusTab === 'all') return list
    if (statusTab === 'open') return list.filter((t) => t.status.toLowerCase() !== 'resolved' && t.status.toLowerCase() !== 'closed')
    return list.filter((t) => t.status.toLowerCase() === 'resolved' || t.status.toLowerCase() === 'closed')
  }, [tickets, statusTab])

  const rows = useMemo(
    () =>
      filteredTickets.map((t) => [
        t.subject,
        <span
          key={`ch-${t.id}`}
          style={{
            display: 'inline-flex',
            padding: '2px 6px',
            borderRadius: 4,
            background: 'var(--surface-2)',
            fontSize: 11,
          }}
        >
          {t.channel}
        </span>,
        <span
          key={`pr-${t.id}`}
          style={{
            display: 'inline-flex',
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background:
              t.priority === 'HIGH' || t.priority === 'CRITICAL'
                ? 'var(--bad-soft)'
                : 'var(--surface-2)',
            color:
              t.priority === 'HIGH' || t.priority === 'CRITICAL'
                ? 'var(--bad)'
                : 'var(--ink-2)',
          }}
        >
          {t.priority}
        </span>,
        <span
          key={`st-${t.id}`}
          style={{
            display: 'inline-flex',
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background:
              t.status === 'RESOLVED' || t.status === 'CLOSED'
                ? 'var(--ok-soft)'
                : 'var(--warn-soft)',
            color:
              t.status === 'RESOLVED' || t.status === 'CLOSED'
                ? 'var(--ok)'
                : 'var(--warn)',
          }}
        >
          {t.status}
        </span>,
        t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : '—',
        <button
          key={t.id}
          type="button"
          onClick={() => setReplyFor({ id: t.id, subject: t.subject })}
          style={{
            border: '1px solid var(--line)',
            borderRadius: 6,
            padding: '6px 10px',
            background: 'var(--surface)',
            color: 'var(--ink)',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Reply
        </button>,
      ]),
    [filteredTickets],
  )

  return (
    <>
      <DcHubFrame
        crumbGroup="Support"
        title="Helpdesk"
        queries={[helpdesk]}
        empty={rows.length === 0}
        emptyState={{
          icon: 'icon-life-buoy',
          title: 'No support tickets',
          body:
            'Tickets raised from the storefront contact form, email and Telegram land here. Create a ticket or reply to incoming customer requests.',
        }}
        actions={[
          {
            label: 'New ticket',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => setNewTicketOpen(true),
          },
        ]}
      >
        <HubTabs
          tabs={[
            { id: 'all', label: 'All Tickets' },
            { id: 'open', label: 'Open' },
            { id: 'resolved', label: 'Resolved' },
          ]}
          active={statusTab}
          onChange={(id) => setStatusTab(id as 'all' | 'open' | 'resolved')}
        />
        <HubKpis
          items={[
            { label: 'Open', value: helpdesk.data?.open ?? 0 },
            { label: 'Total', value: helpdesk.data?.total ?? tickets?.length ?? 0 },
          ]}
        />
        <HubTable columns={['Subject', 'Channel', 'Priority', 'Status', 'Updated', '']} rows={rows} />
      </DcHubFrame>

      {/* REPLY MODAL */}
      <DcModal
        open={Boolean(replyFor)}
        title={replyFor ? `Reply — ${replyFor.subject}` : 'Reply'}
        confirmLabel="Send reply"
        busy={reply.isPending}
        onClose={() => {
          setReplyFor(null)
          setMessage('')
        }}
        onConfirm={() => {
          if (!replyFor || !message.trim()) return
          void (async () => {
            try {
              await reply.mutateAsync({ id: replyFor.id, body: message.trim() })
              toast('ok', 'Reply sent', replyFor.subject)
              setReplyFor(null)
              setMessage('')
            } catch (err) {
              const msg =
                err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Reply failed'
              toast('bad', 'Reply not sent', msg)
            }
          })()
        }}
      >
        <DcField label="Message" value={message} onChange={setMessage} placeholder="Staff reply…" area />
      </DcModal>

      {/* CREATE TICKET MODAL */}
      <DcModal
        open={newTicketOpen}
        title="Create Support Ticket"
        subtitle="Log a customer enquiry or support issue."
        confirmLabel="Create Ticket"
        busy={createTicketMutation.isPending}
        onClose={() => setNewTicketOpen(false)}
        onConfirm={() => void handleCreateTicket()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
          <DcField
            label="Subject *"
            value={newSubject}
            onChange={setNewSubject}
            placeholder="e.g. Delayed Delivery / Exchange Request"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>Channel</label>
              <select
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  fontSize: 12,
                }}
              >
                <option value="LIVE_CHAT">Live chat</option>
                <option value="TELEGRAM">Telegram</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="PHONE">Phone</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  fontSize: 12,
                }}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
          <DcField
            label="Initial Message / Notes"
            value={newMessage}
            onChange={setNewMessage}
            placeholder="Customer concern details..."
            area
          />
        </div>
      </DcModal>
    </>
  )
}

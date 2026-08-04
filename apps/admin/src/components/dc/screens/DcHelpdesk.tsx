'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcField, DcModal } from '@/components/dc/DcModal'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable } from '@/components/dc/screens/DcHubKit'
import { replyHelpdeskTicket } from '@/lib/api/commerce-os'
import { useHelpdeskOverview } from '@/lib/api/hooks'
import { ApiError } from '@/lib/api/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

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
  const [replyFor, setReplyFor] = useState<{ id: string; subject: string } | null>(null)
  const [message, setMessage] = useState('')

  const reply = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => replyHelpdeskTicket(id, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['helpdesk-overview'] })
    },
  })

  const tickets = helpdesk.data?.tickets ?? []
  const rows = useMemo(
    () =>
      tickets.map((t) => [
        t.subject,
        t.channel,
        t.priority,
        t.status,
        t.updatedAt,
        <button
          key={t.id}
          type="button"
          onClick={() => setReplyFor({ id: t.id, subject: t.subject })}
          style={{
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '4px 10px',
            background: 'transparent',
            cursor: 'pointer',
            font: '600 12px/1 var(--font-ui, inherit)',
          }}
        >
          Reply
        </button>,
      ]),
    [tickets],
  )

  return (
    <>
      <DcHubFrame
        crumbGroup="Support"
        title="Helpdesk"
        queries={[helpdesk]}
        empty={rows.length === 0}
      >
        <HubKpis
          items={[
            { label: 'Open', value: helpdesk.data?.open ?? 0 },
            { label: 'Total', value: helpdesk.data?.total ?? tickets.length },
          ]}
        />
        <HubTable columns={['Subject', 'Channel', 'Priority', 'Status', 'Updated', '']} rows={rows} />
      </DcHubFrame>

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
    </>
  )
}

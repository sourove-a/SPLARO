'use client'

import { useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { HandoffPageChrome } from '@/components/ui/HandoffPageChrome'
import { KpiGrid } from '@/components/ui/AdminHandoffBlocks'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import { useMarketingOverview } from '@/lib/api/hooks'
import { sendTestSms } from '@/lib/api/notifications'
import type { ModuleContextProps } from '@/lib/modules/module-data'

function banglaSegments(text: string): { chars: number; segments: number; costHint: string } {
  const chars = [...text].length
  // Unicode SMS: 70 chars per segment (UCS-2). English GSM would be 160 — we bill for Bangla path.
  const segments = chars === 0 ? 0 : Math.ceil(chars / 70)
  const cost = segments * 0.35
  return {
    chars,
    segments,
    costHint: segments === 0 ? '—' : `≈ ৳${cost.toFixed(2)} if Bangla (70/seg)`,
  }
}

/**
 * Handoff SMS Center — Bangla segment costing + provider chain honesty.
 * Handoff SMS Center — Bangla segment costing + verified test send API.
 */
export function SmsCenterPanel(_props: ModuleContextProps) {
  const { data, isError, isLoading, refetch } = useMarketingOverview()
  const [testPhone, setTestPhone] = useState('01711204556')
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState(
    'আপনার SPLARO অর্ডার কনফার্ম হয়েছে। COD ডেলিভারির আগে কল আসবে।',
  )
  const stats = useMemo(() => banglaSegments(draft), [draft])
  const smsLogs = data?.smsLogs ?? []

  if (isError) {
    return <ApiOfflineBanner message="SMS / marketing API offline — start pnpm dev:api." />
  }

  return (
    <HandoffPageChrome
      group="Integrations"
      title="SMS Center"
      sync={isLoading ? 'loading…' : 'BDBulkSMS → ElitBuzz → GreenWeb'}
      actions={
        <>
          <AdminButton
            size="sm"
            variant="ghost"
            onClick={() => void refetch()}
          >
            Refresh logs
          </AdminButton>
          <AdminButton
            size="sm"
            variant="primary"
            loading={sending}
            onClick={() => {
              void (async () => {
                setSending(true)
                try {
                  const res = await sendTestSms(testPhone, draft)
                  if (!res.ok) {
                    toastFail(res.message || 'SMS test was not sent.')
                    return
                  }
                  toastOk(res.message)
                  void refetch()
                } catch (e) {
                  toastFail(e instanceof Error ? e.message : 'SMS test failed')
                } finally {
                  setSending(false)
                }
              })()
            }}
          >
            <Send className="h-3.5 w-3.5" />
            Send test
          </AdminButton>
        </>
      }
    >
      <div className="admin-beta-banner" role="note">
        <span className="admin-beta-banner__chip">BANGLA</span>
        <span>
          Unicode SMS = <strong>70 characters</strong> per segment (not 160). A long COD reminder can cost 3× English.
          When <code>smsEnabled</code> is off in Settings, nothing sends and nothing warns.
        </span>
      </div>

      <KpiGrid
        columns={4}
        items={[
          { label: 'SMS logs', value: isLoading ? '…' : smsLogs.length, sub: 'notification_delivery_log' },
          { label: 'Draft chars', value: stats.chars, sub: 'Unicode count' },
          { label: 'Segments', value: stats.segments || '—', sub: '70 chars each' },
          { label: 'Est. cost', value: stats.costHint, sub: '৳0.35 / segment (example)' },
        ]}
      />

      <section className="admin-module-card">
        <p className="admin-module-card__title">Template draft · segment preview</p>
        <p className="admin-module-card__text mb-3">
          Provider chain (first configured wins): BDBulkSMS → ElitBuzz → GreenWeb. Phone normalisation turns
          01711-204556 / +880… into 8801711204556.
        </p>
        <textarea
          className="admin-input min-h-[120px] w-full resize-y"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="SMS draft"
        />
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-semibold text-[var(--admin-text-muted)]">
            Test phone (BD)
            <input
              className="admin-input"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
            />
          </label>
        </div>
        <p className="mt-2 text-xs font-semibold text-[var(--admin-text-muted)]">
          {stats.chars} chars · {stats.segments || 0} segment(s) · {stats.costHint}
        </p>
      </section>

      <section className="admin-module-card">
        <p className="admin-module-card__title">Provider chain</p>
        <ul className="m-0 list-none space-y-2 p-0">
          {[
            ['1 · BDBulkSMS', 'bulksmsbd.net · success contains 1001'],
            ['2 · ElitBuzz', 'msg.elitbuzz-bd.com · response_code 202'],
            ['3 · GreenWeb', 'api.greenweb.com.bd · OK'],
          ].map(([title, sub]) => (
            <li key={title} className="admin-vis-row">
              <div className="admin-vis-row__meta">
                <span className="admin-vis-row__title">{title}</span>
                <span className="admin-vis-row__hint">{sub}</span>
              </div>
            </li>
          ))}
        </ul>
        <AdminButton
          className="mt-3"
          size="sm"
          variant="ghost"
          onClick={() => toastFail('Configure provider keys in API env — UI does not invent a successful send.')}
        >
          Open credentials note
        </AdminButton>
      </section>

      <section className="admin-module-table-wrap">
        <div className="admin-module-table-head">
          <p className="font-semibold text-[var(--admin-text-strong)]">Recent SMS logs</p>
        </div>
        {smsLogs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--admin-text-muted)]">No SMS logs yet.</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-[var(--admin-foundation-border)] p-0">
            {smsLogs.slice(0, 12).map((log, i) => (
              <li key={String((log as { id?: string }).id ?? i)} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-semibold text-[var(--admin-text)]">
                  {(log as { to?: string; phone?: string }).to ??
                    (log as { phone?: string }).phone ??
                    'SMS'}
                </span>
                <span className="text-[var(--admin-text-muted)]">
                  {(log as { status?: string }).status ?? 'logged'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </HandoffPageChrome>
  )
}

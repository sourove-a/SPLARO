'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcModal } from '@/components/dc/DcModal'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import { useNotificationsOverview } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import {
  fetchLowStockAlerts,
  fetchNotificationPreferences,
  sendTestEmail,
  sendTestSms,
  sendTestTelegram,
  triggerLowStockAlerts,
  type LowStockVariantAlert,
  type NotificationLogItem,
} from '@/lib/api/notifications'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const th = {
  textAlign: 'left' as const,
  padding: '10px 14px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

const inputStyle = {
  minHeight: 34,
  padding: '6px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  outline: 0,
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  font: `400 12px/1.4 ${FONT}`,
} as const

const CHANNEL_TONE: Record<string, DcTone> = {
  TELEGRAM: 'info',
  EMAIL: 'info',
  SMS: 'ok',
}

const STATUS_TONE: Record<string, DcTone> = {
  SENT: 'ok',
  DELIVERED: 'ok',
  PENDING: 'warn',
  FAILED: 'bad',
}

const LEVEL_TONE: Record<string, DcTone> = {
  info: 'info',
  warning: 'warn',
  critical: 'bad',
}

export function DcNotificationCenter() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="notifications" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcNotificationCenterBody />
    </DcScreenProvider>
  )
}

function DcNotificationCenterBody() {
  const router = useRouter()
  const qc = useQueryClient()

  // Filters state
  const [channelFilter, setChannelFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Modals state
  const [testModalOpen, setTestModalOpen] = useState<boolean>(false)
  const [testChannel, setTestChannel] = useState<'TELEGRAM' | 'SMS' | 'EMAIL'>('TELEGRAM')
  const [testPhone, setTestPhone] = useState<string>('')
  const [testEmailAddr, setTestEmailAddr] = useState<string>('')
  const [testMessage, setTestMessage] = useState<string>('')

  const [selectedLog, setSelectedLog] = useState<NotificationLogItem | null>(null)
  const [lowStockModalOpen, setLowStockModalOpen] = useState<boolean>(false)

  // Queries
  const notifications = useNotificationsOverview()
  const preferences = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences,
    staleTime: 30_000,
  })
  const lowStock = useQuery({
    queryKey: ['notification-low-stock'],
    queryFn: fetchLowStockAlerts,
    staleTime: 20_000,
  })

  const { api } = useAdminConnection(25_000)
  const pageStatus = dcPageStatus([notifications, preferences], api.pulse)

  const logs = useMemo(() => (notifications.data?.logs ?? []) as NotificationLogItem[], [notifications.data])
  const summary = notifications.data?.summary
  const lowStockItems = useMemo(() => lowStock.data ?? [], [lowStock.data])

  // Filtered log rows
  const filteredLogs = useMemo(() => {
    let list = logs
    if (channelFilter !== 'ALL') {
      list = list.filter((l) => l.channel?.toUpperCase() === channelFilter)
    }
    if (statusFilter !== 'ALL') {
      list = list.filter((l) => l.status?.toUpperCase() === statusFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (l) =>
          l.recipient?.toLowerCase().includes(q) ||
          l.subject?.toLowerCase().includes(q) ||
          l.body?.toLowerCase().includes(q),
      )
    }
    return list
  }, [logs, channelFilter, statusFilter, searchQuery])

  // ── MUTATIONS ─────────────────────────────────────────────

  const testTelegramMutation = useMutation({
    mutationFn: (msg?: string) => sendTestTelegram(msg),
    onSuccess: () => {
      setTestModalOpen(false)
      toastOk('Telegram test message dispatched')
      void qc.invalidateQueries({ queryKey: ['hub-notifications'] })
    },
    onError: (err) => toastFail(err instanceof Error ? err.message : 'Telegram test failed'),
  })

  const testSmsMutation = useMutation({
    mutationFn: ({ phone, message }: { phone: string; message?: string }) => sendTestSms(phone, message),
    onSuccess: (res) => {
      setTestModalOpen(false)
      if (res.ok) {
        toastOk(res.message)
      } else {
        toastFail(res.message)
      }
      void qc.invalidateQueries({ queryKey: ['hub-notifications'] })
    },
    onError: (err) => toastFail(err instanceof Error ? err.message : 'SMS test failed'),
  })

  const testEmailMutation = useMutation({
    mutationFn: (to: string) => sendTestEmail(to),
    onSuccess: (res) => {
      setTestModalOpen(false)
      if (res.ok) {
        toastOk(res.message)
      } else {
        toastFail(res.message)
      }
      void qc.invalidateQueries({ queryKey: ['hub-notifications'] })
    },
    onError: (err) => toastFail(err instanceof Error ? err.message : 'Email test failed'),
  })

  const triggerLowStockMutation = useMutation({
    mutationFn: triggerLowStockAlerts,
    onSuccess: (res) => {
      toastOk(`Triggered alerts for ${res.triggered} low stock item(s)`)
      void qc.invalidateQueries({ queryKey: ['notification-low-stock'] })
      void qc.invalidateQueries({ queryKey: ['hub-notifications'] })
    },
    onError: (err) => toastFail(err instanceof Error ? err.message : 'Failed to trigger alerts'),
  })

  const handleRunTest = () => {
    const msg = testMessage.trim()
    if (testChannel === 'TELEGRAM') {
      testTelegramMutation.mutate(msg || undefined)
    } else if (testChannel === 'SMS') {
      if (!testPhone.trim()) {
        toastWarn('Enter recipient BD phone number')
        return
      }
      testSmsMutation.mutate({
        phone: testPhone.trim(),
        ...(msg ? { message: msg } : {}),
      })
    } else if (testChannel === 'EMAIL') {
      if (!testEmailAddr.trim()) {
        toastWarn('Enter recipient email address')
        return
      }
      testEmailMutation.mutate(testEmailAddr.trim())
    }
  }

  const exportCsv = () => {
    if (filteredLogs.length === 0) {
      toastWarn('No notification logs to export')
      return
    }
    const headers = ['Channel', 'Recipient', 'Subject', 'Status', 'Level', 'Body', 'CreatedAt']
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map((l) =>
        [
          `"${l.channel}"`,
          `"${(l.recipient ?? '').replace(/"/g, '""')}"`,
          `"${(l.subject ?? '').replace(/"/g, '""')}"`,
          `"${l.status}"`,
          `"${l.level}"`,
          `"${(l.body ?? '').replace(/"/g, '""')}"`,
          `"${l.createdAt}"`,
        ].join(','),
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `splaro-notifications-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toastOk('Notification logs exported to CSV')
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Executive"
        title="Notification Center"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={notifications.isFetching ? 'syncing…' : `${summary?.total ?? 0} dispatches`}
        syncing={notifications.isFetching}
        onSync={() => {
          void notifications.refetch()
          void preferences.refetch()
          void lowStock.refetch()
        }}
        actions={[
          {
            label: 'Send Test Alert',
            icon: 'icon-send',
            variant: 'primary',
            onClick: () => setTestModalOpen(true),
          },
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: exportCsv,
          },
          {
            label: 'Configure Channels',
            icon: 'icon-settings',
            onClick: () => router.push('/dashboard/settings'),
          },
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ── CHANNEL HEALTH OVERVIEW ────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {/* Telegram Channel Card */}
          <div
            style={{
              ...card,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              cursor: 'pointer',
            }}
            onClick={() => {
              setTestChannel('TELEGRAM')
              setTestModalOpen(true)
            }}
            title="Click to send test Telegram alert"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>Telegram Alerts</span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: preferences.data?.telegramConfigured ? 'var(--ok)' : 'var(--warn)',
                }}
              />
            </div>
            <span style={{ font: `600 11px/1 ${MONO}`, color: preferences.data?.telegramConfigured ? 'var(--ok)' : 'var(--warn)' }}>
              {preferences.data?.telegramConfigured ? 'Bot Connected · Active' : 'Setup Required · Tap to test'}
            </span>
            <span style={{ font: `400 11px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
              Instant order alerts & system status push to staff.
            </span>
          </div>

          {/* Email / SMTP Channel Card */}
          <div
            style={{
              ...card,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              cursor: 'pointer',
            }}
            onClick={() => {
              setTestChannel('EMAIL')
              setTestModalOpen(true)
            }}
            title="Click to send test email"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>Email / SMTP</span>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--ok)' }} />
            </div>
            <span style={{ font: `600 11px/1 ${MONO}`, color: 'var(--ok)' }}>
              {preferences.data?.smtpConfigured ? 'SMTP Gateway Ready' : 'Transactional Engine · Active'}
            </span>
            <span style={{ font: `400 11px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
              Order invoices, partner invites & customer receipts.
            </span>
          </div>

          {/* SMS Channel Card */}
          <div
            style={{
              ...card,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              cursor: 'pointer',
            }}
            onClick={() => {
              setTestChannel('SMS')
              setTestModalOpen(true)
            }}
            title="Click to send test SMS"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>SMS Gateway (BD)</span>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--ok)' }} />
            </div>
            <span style={{ font: `600 11px/1 ${MONO}`, color: 'var(--ok)' }}>
              OTP & Delivery SMS Ready
            </span>
            <span style={{ font: `400 11px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
              Order confirmation & tracking OTP dispatches.
            </span>
          </div>

          {/* Low Stock Alerting System Card */}
          <div
            style={{
              ...card,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              cursor: lowStockItems.length > 0 ? 'pointer' : 'default',
              border: lowStockItems.length > 0 ? '1px solid var(--warn-bd)' : undefined,
            }}
            onClick={() => setLowStockModalOpen(true)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>Low Stock Sentinel</span>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 5,
                  font: `700 9.5px/1 ${FONT}`,
                  background: lowStockItems.length > 0 ? 'var(--warn-soft)' : 'var(--ok-soft)',
                  color: lowStockItems.length > 0 ? 'var(--warn)' : 'var(--ok)',
                  border: `1px solid ${lowStockItems.length > 0 ? 'var(--warn-bd)' : 'var(--ok-bd)'}`,
                }}
              >
                {lowStockItems.length} SKUs Alert
              </span>
            </div>
            <span style={{ font: `600 11px/1 ${MONO}`, color: lowStockItems.length > 0 ? 'var(--warn)' : 'var(--ink-3)' }}>
              {lowStockItems.length > 0 ? 'Items below reorder point' : 'All inventory healthy'}
            </span>
            <span style={{ font: `400 11px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
              Tap to view SKU list or trigger alert notifications.
            </span>
          </div>
        </div>

        {/* ── KPIS OVERVIEW ──────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <KpiTile label="Total Dispatches" value={String(summary?.total ?? 0)} sub="All recorded deliveries" />
          <KpiTile label="Delivered / Sent" value={String(summary?.sent ?? 0)} sub={`${summary?.deliveredRate ?? 0}% success rate`} color="var(--ok)" />
          <KpiTile label="Pending / Queue" value={String(summary?.pending ?? 0)} sub="Awaiting dispatch" color="var(--warn)" />
          <KpiTile label="Failed" value={String(summary?.failed ?? 0)} sub="Requires investigation" color={(summary?.failed ?? 0) > 0 ? 'var(--bad)' : 'var(--ink)'} />
          <KpiTile label="Critical Level" value={String(summary?.critical ?? 0)} sub="High priority alerts" color={(summary?.critical ?? 0) > 0 ? 'var(--bad)' : 'var(--ink)'} />
        </div>

        {/* ── LOGS & DISPATCH AUDIT TABLE ─────────────────────── */}
        <div style={{ ...card, overflow: 'hidden' }}>
          {/* Table Header & Toolbar */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              {/* Channel Tabs */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['ALL', 'TELEGRAM', 'SMS', 'EMAIL'].map((ch) => {
                  const active = channelFilter === ch
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannelFilter(ch)}
                      style={{
                        padding: '5px 11px',
                        borderRadius: 7,
                        border: `1px solid ${active ? 'var(--violet-bd)' : 'var(--line)'}`,
                        background: active ? 'var(--violet-soft)' : 'var(--surface-2)',
                        color: active ? 'var(--violet)' : 'var(--ink-2)',
                        font: `600 11.5px/1 ${FONT}`,
                        cursor: 'pointer',
                      }}
                    >
                      {ch}
                    </button>
                  )
                })}
              </div>

              {/* Status Tabs */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['ALL', 'SENT', 'DELIVERED', 'PENDING', 'FAILED'].map((st) => {
                  const active = statusFilter === st
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      style={{
                        padding: '5px 9px',
                        borderRadius: 7,
                        border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                        background: active ? 'var(--surface-3)' : 'transparent',
                        color: active ? 'var(--ink)' : 'var(--ink-3)',
                        font: `500 11px/1 ${FONT}`,
                        cursor: 'pointer',
                      }}
                    >
                      {st}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipient, subject, phone, email, or message body…"
                style={{ ...inputStyle, width: '100%', paddingLeft: 30 }}
              />
              <span style={{ position: 'absolute', left: 9, top: 10, color: 'var(--ink-3)', pointerEvents: 'none' }}>
                <DcIcon name="icon-search" size={13} />
              </span>
            </div>
          </div>

          {/* Table Content */}
          {filteredLogs.length === 0 ? (
            <div style={{ padding: '42px 18px', textAlign: 'center' }}>
              <DcIcon name="icon-bell" size={24} color="var(--ink-3)" />
              <p style={{ margin: '12px 0 4px', font: `600 14px/1 ${FONT}`, color: 'var(--ink)' }}>
                No matching notifications
              </p>
              <span style={{ font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
                Order, stock, and security alerts will automatically appear here.
              </span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Channel</th>
                    <th style={th}>Recipient</th>
                    <th style={th}>Subject / Body</th>
                    <th style={th}>Status</th>
                    <th style={th}>Level</th>
                    <th style={{ ...th, textAlign: 'right' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const chTone = toneStyle(CHANNEL_TONE[log.channel?.toUpperCase()] ?? 'mute')
                    const stTone = toneStyle(STATUS_TONE[log.status?.toUpperCase()] ?? 'mute')
                    const lvlTone = toneStyle(LEVEL_TONE[log.level?.toLowerCase()] ?? 'info')

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="dc-hover-surface"
                        style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 8px',
                              borderRadius: 6,
                              font: `700 10.5px/1 ${MONO}`,
                              border: `1px solid ${chTone.bd}`,
                              background: chTone.bg,
                              color: chTone.fg,
                            }}
                          >
                            {log.channel}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ font: `600 12.5px/1.2 ${MONO}`, color: 'var(--ink)' }}>
                            {log.recipient || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 360 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {log.subject ? (
                              <strong style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                                {log.subject}
                              </strong>
                            ) : null}
                            <span
                              style={{
                                font: `400 11.5px/1.4 ${FONT}`,
                                color: 'var(--ink-3)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {log.body}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 8px',
                              borderRadius: 6,
                              font: `600 11px/1 ${FONT}`,
                              border: `1px solid ${stTone.bd}`,
                              background: stTone.bg,
                              color: stTone.fg,
                            }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: 5,
                              font: `700 9.5px/1 ${FONT}`,
                              textTransform: 'uppercase',
                              border: `1px solid ${lvlTone.bd}`,
                              background: lvlTone.bg,
                              color: lvlTone.fg,
                            }}
                          >
                            {log.level}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', font: `400 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                          {log.createdAt ? `${log.createdAt.replace('T', ' ').slice(0, 16)} UTC` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ────────────────────────────────────────────── */}

      {/* Send Test Notification Modal */}
      <DcModal
        open={testModalOpen}
        title="Send Test Notification"
        subtitle="Verify provider connections by triggering a test alert"
        confirmLabel="Send Test"
        busy={testTelegramMutation.isPending || testSmsMutation.isPending || testEmailMutation.isPending}
        onClose={() => setTestModalOpen(false)}
        onConfirm={handleRunTest}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Channel</span>
            <select
              value={testChannel}
              onChange={(e) => setTestChannel(e.target.value as 'TELEGRAM' | 'SMS' | 'EMAIL')}
              style={inputStyle}
            >
              <option value="TELEGRAM">Telegram Bot (Admin Hub)</option>
              <option value="SMS">SMS Gateway (Bangladesh Mobile)</option>
              <option value="EMAIL">Email (SMTP)</option>
            </select>
          </label>

          {testChannel === 'SMS' ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Recipient Mobile Number</span>
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                style={inputStyle}
              />
            </label>
          ) : null}

          {testChannel === 'EMAIL' ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Recipient Email</span>
              <input
                value={testEmailAddr}
                onChange={(e) => setTestEmailAddr(e.target.value)}
                placeholder="recipient@example.com"
                style={inputStyle}
              />
            </label>
          ) : null}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Custom Message (Optional)</span>
            <input
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="SPLARO notification test ✓"
              style={inputStyle}
            />
          </label>
        </div>
      </DcModal>

      {/* Notification Log Detail Modal */}
      <DcModal
        open={selectedLog !== null}
        title="Notification Delivery Audit"
        subtitle={`ID: ${selectedLog?.id ?? ''}`}
        confirmLabel="Close"
        onClose={() => setSelectedLog(null)}
        onConfirm={() => setSelectedLog(null)}
      >
        {selectedLog ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '12px 14px', borderRadius: 9, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Channel</span>
                <strong style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>{selectedLog.channel}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Recipient</span>
                <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>{selectedLog.recipient}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Status</span>
                <span style={{ font: `700 11px/1 ${FONT}`, color: selectedLog.status === 'FAILED' ? 'var(--bad)' : 'var(--ok)' }}>
                  {selectedLog.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Timestamp</span>
                <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>{selectedLog.createdAt}</span>
              </div>
            </div>

            {selectedLog.subject ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Subject</span>
                <span style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>{selectedLog.subject}</span>
              </div>
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Message Content</span>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  font: `400 12px/1.5 ${MONO}`,
                  color: 'var(--ink)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}
              >
                {selectedLog.body}
              </div>
            </div>
          </div>
        ) : null}
      </DcModal>

      {/* Low Stock Alerts Modal */}
      <DcModal
        open={lowStockModalOpen}
        title={`Low Stock Variants (${lowStockItems.length} SKUs)`}
        subtitle="Variants currently at or below their designated reorder threshold"
        confirmLabel="Trigger Alerts Now"
        busy={triggerLowStockMutation.isPending}
        onClose={() => setLowStockModalOpen(false)}
        onConfirm={() => triggerLowStockMutation.mutate()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
          {lowStockItems.length === 0 ? (
            <span style={{ font: `400 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)', textAlign: 'center', padding: '16px 0' }}>
              All product variants currently have healthy inventory levels above their reorder points.
            </span>
          ) : (
            lowStockItems.map((item: LowStockVariantAlert) => (
              <div
                key={item.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong style={{ font: `600 12.5px/1.2 ${FONT}`, color: 'var(--ink)' }}>{item.productName}</strong>
                  <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                    SKU: {item.sku} {item.size ? `· ${item.size}` : ''} {item.color ? `· ${item.color}` : ''}
                  </span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ font: `700 13px/1 ${MONO}`, color: 'var(--bad)' }}>
                    {item.stock} left
                  </span>
                  <span style={{ font: `400 10px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    Reorder at {item.reorderPoint}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </DcModal>
    </>
  )
}

function KpiTile({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div style={{ ...card, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ font: `600 11px/1 ${FONT}`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
        {label}
      </span>
      <span style={{ font: `700 24px/1 ${FONT}`, color: color ?? 'var(--ink)' }}>
        {value}
      </span>
      {sub ? <span style={{ font: `400 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span> : null}
    </div>
  )
}

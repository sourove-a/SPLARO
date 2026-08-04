'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, hubCard, hubCaps } from '@/components/dc/screens/DcHubKit'
import { DcEmptyState } from '@/components/dc/blocks/DcStates'
import { FONT, MONO } from '@/components/dc/tokens'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import {
  createManusTask,
  fetchManusMessages,
  fetchManusStatus,
  fetchManusTasks,
  stopManusTask,
  type ManusAgentProfile,
  type ManusTaskStatus,
} from '@/lib/api/manus'

const STATUS_TONE: Record<ManusTaskStatus, string> = {
  running: 'info',
  waiting: 'warn',
  stopped: 'mute',
  error: 'bad',
}

const PROFILE_HINT: Record<ManusAgentProfile, string> = {
  'manus-1.6': 'Balanced — the default.',
  'manus-1.6-lite': 'Cheapest, shallowest. Short lookups.',
  'manus-1.6-max': 'Deepest and most expensive. Long research runs.',
}

function relativeTime(unixSeconds: number): string {
  if (!unixSeconds) return '—'
  const deltaMin = Math.round((Date.now() - unixSeconds * 1000) / 60_000)
  if (deltaMin < 1) return 'just now'
  if (deltaMin < 60) return `${deltaMin}m ago`
  const hours = Math.round(deltaMin / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function DcManusTasks() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="manus" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcManusTasksBody />
    </DcScreenProvider>
  )
}

function DcManusTasksBody() {
  const [prompt, setPrompt] = useState('')
  const [profile, setProfile] = useState<ManusAgentProfile>('manus-1.6')
  const [submitting, setSubmitting] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const status = useQuery({ queryKey: ['manus', 'status'], queryFn: fetchManusStatus })
  const tasks = useQuery({
    queryKey: ['manus', 'tasks'],
    queryFn: () => fetchManusTasks(30),
    enabled: status.data?.configured === true,
    // Manus has no streaming — running tasks only advance by polling.
    refetchInterval: (query) =>
      query.state.data?.tasks.some((t) => t.status === 'running' || t.status === 'waiting') ? 10_000 : false,
  })

  const rows = useMemo(
    () =>
      (tasks.data?.tasks ?? []).map((task) => [
        <span key="title" style={{ display: 'grid', gap: 2 }}>
          <span style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>{task.title}</span>
          <span style={{ font: `500 11px/1.3 ${MONO}`, color: 'var(--ink-3)' }}>{task.id}</span>
        </span>,
        <span
          key="status"
          style={{
            display: 'inline-flex',
            padding: '2px 8px',
            borderRadius: 99,
            border: `1px solid var(--${STATUS_TONE[task.status]}-bd)`,
            background: `var(--${STATUS_TONE[task.status]}-soft)`,
            color: `var(--${STATUS_TONE[task.status]})`,
            font: `700 10px/1.5 ${FONT}`,
            letterSpacing: '.1em',
          }}
        >
          {task.status.toUpperCase()}
        </span>,
        task.agentProfile ?? '—',
        task.creditUsage,
        relativeTime(task.updatedAt || task.createdAt),
      ]),
    [tasks.data],
  )

  const handleSubmit = useCallback(async () => {
    const trimmed = prompt.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      const created = await createManusTask({ prompt: trimmed, agentProfile: profile })
      setPrompt('')
      setOpenTaskId(created.taskId)
      toastOk(`Manus task started — ${created.title}`, 'manus-created')
      await tasks.refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not start Manus task', 'manus-create-fail')
    } finally {
      setSubmitting(false)
    }
  }, [prompt, profile, tasks])

  const handleStop = useCallback(
    async (taskId: string) => {
      try {
        await stopManusTask(taskId)
        toastOk('Task stopped', 'manus-stopped')
        await tasks.refetch()
      } catch (err) {
        toastFail(err instanceof Error ? err.message : 'Could not stop task', 'manus-stop-fail')
      }
    },
    [tasks],
  )

  // The key living only on the API means "not configured" is a real, actionable
  // state — say exactly what to do rather than showing an empty table.
  if (status.data && !status.data.configured) {
    return (
      <DcHubFrame crumbGroup="AI Center" title="Manus Tasks" queries={[status]}>
        <DcEmptyState
          icon="icon-key-round"
          title="Manus is not connected"
          body="AI Command Brain → API keys → Manus e key paste kore Save AI settings dao. Key Manus web app → Settings → API keys theke nao. Browser e key jay na — server DB te encrypt hoye save hoy."
        />
      </DcHubFrame>
    )
  }

  const running = (tasks.data?.tasks ?? []).filter((t) => t.status === 'running').length
  const credits = (tasks.data?.tasks ?? []).reduce((sum, t) => sum + t.creditUsage, 0)

  return (
    <DcHubFrame
      crumbGroup="AI Center"
      title="Manus Tasks"
      queries={[status, tasks]}
      empty={rows.length === 0}
      emptyState={{
        icon: 'icon-bot',
        title: 'No Manus tasks yet',
        body: 'Manus runs long autonomous jobs in its own sandbox — deep research, competitor scraping, document generation. Describe one below to start it. It cannot read SPLARO orders or stock; use Ask SPLARO for that.',
      }}
      errorHint="GET /manus/tasks failed. Save a valid Manus key in AI Command Brain (API keys → Manus), or check MANUS_API_KEY on the API."
    >
      <HubKpis
        items={[
          { label: 'Running now', value: running },
          { label: 'Tasks listed', value: tasks.data?.tasks.length ?? 0 },
          { label: 'Credits used', value: credits },
        ]}
      />

      <section style={{ ...hubCard, padding: 16 }}>
        <p style={{ ...hubCaps, margin: 0 }}>Delegate a job to Manus</p>
        <p style={{ margin: '8px 0 12px', font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-2)' }}>
          Manus is a separate autonomous agent with its own browser and sandbox. It has no access to
          SPLARO data — for orders, stock or finance questions use{' '}
          <strong>Ask SPLARO</strong> instead. Tasks run asynchronously; progress is polled, not streamed.
        </p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="e.g. Research the top 10 Bangladeshi footwear brands selling online, and summarise their pricing and delivery terms as a table."
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 9,
            border: '1px solid var(--line)',
            background: 'var(--surface-2)',
            color: 'var(--ink)',
            font: `400 12.5px/1.6 ${FONT}`,
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value as ManusAgentProfile)}
            style={{
              height: 34,
              padding: '0 10px',
              borderRadius: 9,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `500 12.5px/1 ${FONT}`,
            }}
          >
            {(status.data?.agentProfiles ?? ['manus-1.6']).map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <span style={{ flex: 1, minWidth: 180, font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            {PROFILE_HINT[profile]}
          </span>
          <button
            type="button"
            disabled={submitting || !prompt.trim()}
            onClick={() => void handleSubmit()}
            style={{
              height: 34,
              padding: '0 15px',
              borderRadius: 9,
              border: '1px solid transparent',
              background: prompt.trim() ? 'var(--violet)' : 'var(--surface-3)',
              color: prompt.trim() ? 'var(--on-violet)' : 'var(--ink-3)',
              font: `600 12.5px/1 ${FONT}`,
              cursor: submitting || !prompt.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Starting…' : 'Start task'}
          </button>
        </div>
      </section>

      <HubTable
        columns={['Task', 'Status', 'Profile', 'Credits', 'Updated']}
        rows={rows}
        onRowClick={(index) => {
          const task = tasks.data?.tasks[index]
          if (task) setOpenTaskId((current) => (current === task.id ? null : task.id))
        }}
      />

      {openTaskId ? (
        <ManusTaskLog
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onStop={() => void handleStop(openTaskId)}
        />
      ) : null}
    </DcHubFrame>
  )
}

function ManusTaskLog({
  taskId,
  onClose,
  onStop,
}: {
  taskId: string
  onClose: () => void
  onStop: () => void
}) {
  const [events, setEvents] = useState<Awaited<ReturnType<typeof fetchManusMessages>>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const rows = await fetchManusMessages(taskId, 100)
        if (!cancelled) {
          setEvents(rows)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load task messages')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const timer = setInterval(load, 10_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [taskId])

  return (
    <section style={{ ...hubCard, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <p style={{ ...hubCaps, margin: 0, flex: 1 }}>Task log · {taskId}</p>
        <button type="button" onClick={onStop} style={logButton}>
          Stop task
        </button>
        <button type="button" onClick={onClose} style={logButton}>
          Close
        </button>
      </div>

      {error ? (
        <code
          style={{
            display: 'block',
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 9,
            border: '1px solid var(--bad-bd)',
            background: 'var(--bad-soft)',
            font: `500 12px/1.55 ${MONO}`,
            color: 'var(--ink)',
          }}
        >
          {error}
        </code>
      ) : null}

      {loading && !events.length ? (
        <p style={{ margin: '12px 0 0', font: `400 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
          Loading messages…
        </p>
      ) : null}

      <ol style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
        {events
          .filter((event) => event.content || event.attachments.length)
          .map((event) => (
            <li key={event.id} style={{ display: 'grid', gap: 4 }}>
              <span style={{ font: `700 10px/1 ${FONT}`, letterSpacing: '.12em', color: 'var(--ink-3)' }}>
                {event.type.replace(/_/g, ' ').toUpperCase()}
              </span>
              {event.content ? (
                <span style={{ font: `400 12.5px/1.6 ${FONT}`, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
                  {event.content}
                </span>
              ) : null}
              {event.attachments.map((file) => (
                <a
                  key={file.url}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ font: `600 12px/1.4 ${MONO}`, color: 'var(--info)' }}
                >
                  {file.filename}
                </a>
              ))}
            </li>
          ))}
      </ol>
    </section>
  )
}

const logButton = {
  height: 30,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--line-2)',
  background: 'var(--surface-2)',
  color: 'var(--ink-2)',
  font: `600 11.5px/1 ${FONT}`,
  cursor: 'pointer',
} as const

'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { DcField, DcModal } from '@/components/dc/DcModal'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import { toastApiSaved, toastFail, toastOk } from '@/lib/admin/feedback'
import type { PayrollRunRow } from '@/lib/api/commerce-os'
import {
  useCompanyOverview,
  useCreateCompanyTask,
  useCreateEmployee,
  useCreatePayrollRun,
  usePayrollRuns,
  useUpdateCompanyTaskStatus,
} from '@/lib/api/hooks'
import { formatBDT } from '@/lib/format/currency'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const capsStyle = {
  display: 'block',
  font: `600 10.5px/1.4 ${FONT}`,
  letterSpacing: '.11em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const fieldStyle = {
  marginTop: 6,
  padding: '8px 10px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  font: `500 12.5px/1.4 ${FONT}`,
} as const

export function DcCompanyOs() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="company" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcCompanyOsBody />
    </DcScreenProvider>
  )
}

function DcCompanyOsBody() {
  const company = useCompanyOverview()
  const payroll = usePayrollRuns()
  const [tab, setTab] = useState<'overview' | 'employees' | 'tasks' | 'payroll'>('overview')

  const runPayroll = useCreatePayrollRun()
  const createEmployeeMutation = useCreateEmployee()
  const createTaskMutation = useCreateCompanyTask()
  const updateTaskStatusMutation = useUpdateCompanyTaskStatus()

  // Add employee modal
  const [empModalOpen, setEmpModalOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [position, setPosition] = useState('')
  const [salary, setSalary] = useState('25000')

  // Create task modal
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskPriority, setTaskPriority] = useState('MEDIUM')
  const [taskDueDate, setTaskDueDate] = useState('')

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const activeEmployees = (company.data?.employees ?? []).filter((e) => e.status === 'ACTIVE')
  const projectedTotal = activeEmployees.reduce((sum, e) => sum + Number(e.salary || 0), 0)
  const alreadyRun = (payroll.data ?? []).some((r) => r.month === month && r.year === year)

  const handleRunPayroll = async () => {
    try {
      const created = await runPayroll.mutateAsync({ month, year })
      toastOk(
        `Payroll drafted for ${month}/${year} — ${formatTaka(Number(created.total || 0))}`,
        'payroll-run-ok',
      )
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not create the payroll run', 'payroll-run-fail')
    }
  }

  const handleCreateEmployee = async () => {
    if (!firstName.trim()) {
      toastFail('First name is required')
      return
    }

    try {
      const sal = parseFloat(salary)
      const empPayload: {
        firstName: string
        lastName: string
        email?: string
        phone?: string
        position?: string
        salary?: number
      } = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || '—',
        salary: !isNaN(sal) ? sal : 0,
      }
      if (email.trim()) empPayload.email = email.trim()
      if (phone.trim()) empPayload.phone = phone.trim()
      if (position.trim()) empPayload.position = position.trim()

      await createEmployeeMutation.mutateAsync(empPayload)
      toastApiSaved('Employee registered')
      setEmpModalOpen(false)
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setPosition('')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Failed to create employee')
    }
  }

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      toastFail('Task title is required')
      return
    }

    try {
      const taskPayload: {
        title: string
        priority?: string
        dueDate?: string
      } = {
        title: taskTitle.trim(),
        priority: taskPriority,
      }
      if (taskDueDate.trim()) taskPayload.dueDate = taskDueDate.trim()

      await createTaskMutation.mutateAsync(taskPayload)
      toastApiSaved('Task created')
      setTaskModalOpen(false)
      setTaskTitle('')
      setTaskDueDate('')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Failed to create task')
    }
  }

  const handleToggleTaskStatus = useCallback(
    async (taskId: string, currentStatus: string) => {
      const done = currentStatus === 'DONE'
      const nextStatus = done ? 'TODO' : 'DONE'
      try {
        await updateTaskStatusMutation.mutateAsync({
          id: taskId,
          status: nextStatus,
        })
        toastOk(done ? 'Task reopened' : 'Task marked done')
      } catch (err) {
        toastFail(err instanceof Error ? err.message : 'Failed to update task')
      }
    },
    [updateTaskStatusMutation],
  )

  const rows = useMemo(() => {
    const employees = company.data?.employees ?? []
    const tasks = company.data?.tasks ?? []
    const payrollRuns: PayrollRunRow[] = payroll.data ?? []

    if (tab === 'employees' || tab === 'overview') {
      return employees.slice(0, 40).map((e) => [
        `${e.firstName} ${e.lastName ?? ''}`.trim(),
        e.position ?? '—',
        e.phone ?? e.email ?? '—',
        <span
          key={`emp-${e.id}`}
          style={{
            display: 'inline-flex',
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: e.status === 'ACTIVE' ? 'var(--ok-soft)' : 'var(--surface-2)',
            color: e.status === 'ACTIVE' ? 'var(--ok)' : 'var(--ink-2)',
          }}
        >
          {e.status}
        </span>,
        formatBDT(Number(e.salary || 0)),
      ])
    }

    if (tab === 'tasks') {
      return tasks.map((t) => [
        t.title ?? 'Untitled task',
        <span
          key={`tp-${t.id}`}
          style={{
            display: 'inline-flex',
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: t.priority === 'HIGH' ? 'var(--bad-soft)' : 'var(--surface-2)',
            color: t.priority === 'HIGH' ? 'var(--bad)' : 'var(--ink-2)',
          }}
        >
          {t.priority}
        </span>,
        <span
          key={`ts-${t.id}`}
          style={{
            display: 'inline-flex',
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: t.status === 'DONE' ? 'var(--ok-soft)' : 'var(--warn-soft)',
            color: t.status === 'DONE' ? 'var(--ok)' : 'var(--warn)',
          }}
        >
          {t.status}
        </span>,
        t.dueDate ?? '—',
        <button
          key={`act-${t.id}`}
          type="button"
          onClick={() => void handleToggleTaskStatus(t.id, t.status)}
          style={{
            border: '1px solid var(--line)',
            borderRadius: 6,
            padding: '3px 8px',
            background: 'var(--surface)',
            color: 'var(--ink)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {t.status === 'DONE' ? 'Reopen' : 'Complete ✓'}
        </button>,
      ])
    }

    return payrollRuns.slice(0, 40).map((run) => [
      String(run.month),
      String(run.year),
      <span
        key={`pr-${run.id}`}
        style={{
          display: 'inline-flex',
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          background: 'var(--ok-soft)',
          color: 'var(--ok)',
        }}
      >
        {run.status}
      </span>,
      formatBDT(Number(run.total || 0)),
    ])
  }, [tab, company.data, payroll.data, handleToggleTaskStatus])

  return (
    <>
      <DcHubFrame
        crumbGroup="Company OS"
        title="Company OS"
        queries={[company, payroll]}
        empty={rows.length === 0 && tab !== 'overview' && tab !== 'payroll'}
        emptyState={{
          icon: 'icon-users',
          title: 'No employees or tasks yet',
          body:
            'Company OS tracks staff records, payroll runs and internal tasks. Register staff members or add internal tasks.',
        }}
        actions={[
          tab === 'employees' || tab === 'overview'
            ? {
                label: 'Add employee',
                icon: 'icon-plus',
                variant: 'primary',
                onClick: () => setEmpModalOpen(true),
              }
            : tab === 'tasks'
              ? {
                  label: 'Create task',
                  icon: 'icon-plus',
                  variant: 'primary',
                  onClick: () => setTaskModalOpen(true),
                }
              : {
                  label: 'Refresh',
                  icon: 'icon-refresh-cw',
                  variant: 'ghost',
                  onClick: () => {
                    void company.refetch()
                    void payroll.refetch()
                  },
                },
        ]}
      >
        <HubTabs
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'employees', label: 'Employees' },
            { id: 'tasks', label: 'Tasks' },
            { id: 'payroll', label: 'Payroll' },
          ]}
          active={tab}
          onChange={(id) => setTab(id as typeof tab)}
        />
        <HubKpis
          items={[
            { label: 'Employees', value: company.data?.employees?.length ?? 0 },
            { label: 'Tasks', value: company.data?.tasks?.length ?? 0 },
            { label: 'Departments', value: company.data?.departments?.length ?? 0 },
          ]}
        />
        {tab === 'payroll' ? (
          <section
            style={{
              border: '1px solid var(--line)',
              borderRadius: 14,
              background: 'var(--surface)',
              backgroundImage: 'var(--card-sheen)',
              padding: 16,
            }}
          >
            <p style={capsStyle}>Run payroll</p>
            <p style={{ margin: '8px 0 0', font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-2)' }}>
              Drafts a run for every <strong>ACTIVE</strong> employee at their current salary. Bonus and
              deduction overrides can be applied after creating the draft.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginTop: 14,
                alignItems: 'end',
              }}
            >
              <label>
                <span style={capsStyle}>Period month</span>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  style={{ ...fieldStyle, width: '100%' }}
                >
                  {MONTHS.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name} ({i + 1})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span style={capsStyle}>Period year</span>
                <input
                  type="number"
                  value={year}
                  min={2020}
                  max={2035}
                  onChange={(e) => setYear(Number(e.target.value))}
                  style={{ ...fieldStyle, width: '100%', fontFamily: MONO }}
                />
              </label>

              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                }}
              >
                <span style={capsStyle}>Projected payroll</span>
                <span style={{ display: 'block', marginTop: 4, font: `700 14px/1 ${MONO}`, color: 'var(--ink)' }}>
                  {formatBDT(projectedTotal)}
                </span>
                <span style={{ display: 'block', marginTop: 3, font: `400 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>
                  {activeEmployees.length} active employee{activeEmployees.length === 1 ? '' : 's'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleRunPayroll()}
                disabled={runPayroll.isPending || activeEmployees.length === 0 || alreadyRun}
                style={{
                  height: 38,
                  padding: '0 16px',
                  borderRadius: 9,
                  border: '1px solid var(--primary-border, rgba(113,46,255,0.4))',
                  background: 'var(--primary, var(--admin-c-712eff))',
                  color: 'var(--on-primary, var(--admin-color-white))',
                  font: `600 12.5px/1 ${FONT}`,
                  cursor: runPayroll.isPending || activeEmployees.length === 0 || alreadyRun ? 'not-allowed' : 'pointer',
                  opacity: runPayroll.isPending || activeEmployees.length === 0 || alreadyRun ? 0.55 : 1,
                }}
              >
                {alreadyRun ? 'Run exists for period' : runPayroll.isPending ? 'Drafting…' : 'Draft payroll run'}
              </button>
            </div>

            <div style={{ marginTop: 24 }}>
              <p style={capsStyle}>Historical payroll runs</p>
              <HubTable columns={['Month', 'Year', 'Status', 'Total']} rows={rows} />
            </div>
          </section>
        ) : (
          <HubTable
            columns={
              tab === 'tasks'
                ? ['Task', 'Priority', 'Status', 'Due Date', '']
                : ['Name', 'Position', 'Contact', 'Status', 'Salary']
            }
            rows={rows}
          />
        )}
      </DcHubFrame>

      {/* ADD EMPLOYEE MODAL */}
      <DcModal
        open={empModalOpen}
        title="Add Employee"
        subtitle="Register a new staff member in Company OS."
        confirmLabel="Save Employee"
        busy={createEmployeeMutation.isPending}
        onClose={() => setEmpModalOpen(false)}
        onConfirm={() => void handleCreateEmployee()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <DcField
              label="First Name *"
              value={firstName}
              onChange={setFirstName}
              placeholder="e.g. Tanvir"
            />
            <DcField
              label="Last Name"
              value={lastName}
              onChange={setLastName}
              placeholder="e.g. Ahmed"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <DcField
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="tanvir@splaro.co"
            />
            <DcField
              label="Phone"
              value={phone}
              onChange={setPhone}
              placeholder="01700000000"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <DcField
              label="Position / Role"
              value={position}
              onChange={setPosition}
              placeholder="e.g. Operations Lead"
            />
            <DcField
              label="Monthly Salary (BDT)"
              value={salary}
              onChange={setSalary}
              placeholder="25000"
            />
          </div>
        </div>
      </DcModal>

      {/* CREATE TASK MODAL */}
      <DcModal
        open={taskModalOpen}
        title="Create Internal Task"
        subtitle="Assign or track operations and team tasks."
        confirmLabel="Create Task"
        busy={createTaskMutation.isPending}
        onClose={() => setTaskModalOpen(false)}
        onConfirm={() => void handleCreateTask()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
          <DcField
            label="Task Title *"
            value={taskTitle}
            onChange={setTaskTitle}
            placeholder="e.g. Inventory count for Eid collection"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>Priority</label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value)}
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
              </select>
            </div>
            <DcField
              label="Due Date"
              value={taskDueDate}
              onChange={setTaskDueDate}
              placeholder="YYYY-MM-DD"
            />
          </div>
        </div>
      </DcModal>
    </>
  )
}

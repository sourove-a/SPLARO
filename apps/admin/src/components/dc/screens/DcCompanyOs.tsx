'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { useCompanyOverview, useCreatePayrollRun, usePayrollRuns } from '@/lib/api/hooks'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import type { PayrollRunRow } from '@/lib/api/commerce-os'
import { formatBDT } from '@/lib/format/currency'


const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
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
      // Duplicate period and "no active employees" both come back from the API.
      toastFail(err instanceof Error ? err.message : 'Could not create the payroll run', 'payroll-run-fail')
    }
  }

  const rows = useMemo(() => {
    const employees = company.data?.employees ?? []
    const tasks = company.data?.tasks ?? []
    const payrollRuns: PayrollRunRow[] = payroll.data ?? []
    if (tab === 'employees' || tab === 'overview') {
      return employees.slice(0, 40).map((e) => [
        `${e.firstName} ${e.lastName}`.trim(),
        e.position ?? '—',
        e.phone ?? e.email ?? '—',
        e.status,
        formatBDT(Number(e.salary || 0)),
      ])
    }
    if (tab === 'tasks') {
      return tasks.map((t) => [t.title, t.priority, t.status, t.dueDate ?? '—'])
    }
    return payrollRuns.slice(0, 40).map((run) => [
      String(run.month),
      String(run.year),
      run.status,
      formatBDT(Number(run.total || 0)),
    ])
  }, [tab, company.data, payroll.data])

  return (
    <DcHubFrame
      crumbGroup="Company OS"
      title="Company OS"
      queries={[company, payroll]}
      empty={rows.length === 0 && tab !== 'overview'}
      emptyState={{
        icon: 'icon-users',
        title: 'No employees or payroll runs yet',
        body:
          "Company OS tracks staff records, payroll runs and internal tasks. Add an employee before running your first payroll.",
      }}
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
            deductions start at zero and are adjusted per line afterwards. The draft writes to the
            database — it does not pay anyone.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginTop: 14 }}>
            <label>
              <span style={capsStyle}>Month</span>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={fieldStyle}>
                {MONTHS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={capsStyle}>Year</span>
              <input
                value={year}
                onChange={(e) => setYear(Number(e.target.value.replace(/[^0-9]/g, '')) || now.getFullYear())}
                inputMode="numeric"
                style={{ ...fieldStyle, width: 96, fontFamily: MONO }}
              />
            </label>
            <span style={{ flex: 1, minWidth: 170 }}>
              <span style={capsStyle}>Projected total</span>
              <span style={{ display: 'block', marginTop: 6, font: `800 18px/1 ${MONO}`, color: 'var(--ink)' }}>
                {formatTaka(projectedTotal)}
              </span>
              <span style={{ display: 'block', font: `500 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                {activeEmployees.length} active employee{activeEmployees.length === 1 ? '' : 's'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void handleRunPayroll()}
              disabled={runPayroll.isPending || alreadyRun || activeEmployees.length === 0}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 9,
                font: `600 12.5px/1 ${FONT}`,
                cursor:
                  runPayroll.isPending || alreadyRun || activeEmployees.length === 0
                    ? 'not-allowed'
                    : 'pointer',
                border: '1px solid transparent',
                background:
                  alreadyRun || activeEmployees.length === 0 ? 'var(--surface-3)' : 'var(--violet)',
                color: alreadyRun || activeEmployees.length === 0 ? 'var(--ink-3)' : 'var(--on-violet)',
              }}
            >
              {runPayroll.isPending ? 'Drafting…' : 'Create draft run'}
            </button>
          </div>

          {alreadyRun ? (
            <p style={{ margin: '10px 0 0', font: `600 11.5px/1.5 ${FONT}`, color: 'var(--warn)' }}>
              A run already exists for {MONTHS[month - 1]} {year}. Pick another period.
            </p>
          ) : activeEmployees.length === 0 ? (
            <p style={{ margin: '10px 0 0', font: `600 11.5px/1.5 ${FONT}`, color: 'var(--warn)' }}>
              No ACTIVE employees — payroll has nothing to draft.
            </p>
          ) : null}
        </section>
      ) : null}

      <HubTable
        columns={
          tab === 'tasks'
            ? ['Task', 'Priority', 'Status', 'Due']
            : tab === 'payroll'
              ? ['Month', 'Year', 'Status', 'Total']
              : ['Name', 'Role', 'Contact', 'Status', 'Salary']
        }
        rows={rows}
      />
    </DcHubFrame>
  )
}

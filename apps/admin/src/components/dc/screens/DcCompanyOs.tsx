'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { useCompanyOverview, usePayrollRuns } from '@/lib/api/hooks'
import type { PayrollRunRow } from '@/lib/api/commerce-os'
import { formatBDT } from '@/lib/format/currency'

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

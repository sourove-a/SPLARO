import { ModuleBlueprint } from '@/components/admin/module-blueprint';

export default function AdminSecurityPage() {
  return (
    <ModuleBlueprint
      title="Security & Governance"
      subtitle="Role-based access, session controls, and traceable audit operations."
      features={[
        { title: 'Audit Log Table', status: 'done', description: 'Audit trails are already written for critical admin mutations.' },
        { title: 'Role Matrix (Super Admin / Editor / Viewer)', status: 'done', description: 'Navigation and module access now use role constraints.' },
        { title: 'Admin Session Monitor', status: 'planned', description: 'Active session list with remote revoke controls.' },
        { title: 'MFA + Policy Rules', status: 'planned', description: 'MFA enforcement and IP/location policy controls.' },
      ]}
    />
  );
}

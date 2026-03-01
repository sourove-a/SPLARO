import { ModuleBlueprint } from '@/components/admin/module-blueprint';

export default function AdminCustomersPage() {
  return (
    <ModuleBlueprint
      title="Customers CRM"
      subtitle="Unified customer intelligence: profile, purchase behavior, segmentation and loyalty lifecycle."
      features={[
        { title: 'Customer 360 Profile', status: 'planned', description: 'Identity, address book, LTV, AOV, support interactions in one view.' },
        { title: 'Segments', status: 'planned', description: 'VIP, churn-risk, high-return, dormant cohorts with rule builder.' },
        { title: 'Order History Timeline', status: 'done', description: 'Customer-level order feed is already present in admin APIs.' },
        { title: 'Notes & Tasks', status: 'planned', description: 'Internal CRM notes with assignment and reminders.' },
      ]}
    />
  );
}

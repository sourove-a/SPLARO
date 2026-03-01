import { ModuleBlueprint } from '@/components/admin/module-blueprint';

export default function AdminPaymentsPage() {
  return (
    <ModuleBlueprint
      title="Payments Control"
      subtitle="Gateway orchestration for SSLCommerz, bKash, Nagad and COD with reconciliation support."
      features={[
        { title: 'SSLCommerz Webhook Foundation', status: 'done', description: 'Core payment event structures exist in schema and routes.' },
        { title: 'bKash + Nagad Native Flows', status: 'planned', description: 'Tokenized checkout and refund automation.' },
        { title: 'COD Controls', status: 'planned', description: 'COD eligibility rules and risk-threshold gating.' },
        { title: 'Settlement Reconciliation', status: 'planned', description: 'Gateway payout vs order ledger reconciliation center.' },
      ]}
    />
  );
}

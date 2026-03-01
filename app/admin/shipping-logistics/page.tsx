import { ModuleBlueprint } from '@/components/admin/module-blueprint';

export default function AdminShippingLogisticsPage() {
  return (
    <ModuleBlueprint
      title="Shipping & Logistics"
      subtitle="Zone pricing, courier orchestration and real-time fulfillment tracking."
      features={[
        { title: 'Steadfast Integration', status: 'done', description: 'Existing stack includes shipment tracking and health visibility hooks.' },
        { title: 'Pathao Connector', status: 'planned', description: 'Booking API, label generation and sync timeline.' },
        { title: 'Zone & Rate Tables', status: 'planned', description: 'City-wise SLA, COD fee and expedited options.' },
        { title: 'NDR / Return Handling', status: 'planned', description: 'Failed delivery workflows and reverse logistics.' },
      ]}
    />
  );
}

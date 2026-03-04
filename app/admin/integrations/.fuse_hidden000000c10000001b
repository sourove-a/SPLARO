import { listIntegrationsForPage } from '@/app/actions/integrations';
import { IntegrationsPanel } from '@/components/admin/integrations-panel';

export default async function AdminIntegrationsPage() {
  const initialRows = await listIntegrationsForPage();
  return <IntegrationsPanel initialRows={initialRows} />;
}

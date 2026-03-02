import { redirect } from 'next/navigation';

export default function LegacyAdminCampaignsRedirect() {
  redirect('/admin/marketing');
}

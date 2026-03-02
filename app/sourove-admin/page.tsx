import { redirect } from 'next/navigation';

export default function LegacySouroveAdminRedirect() {
  redirect('/admin/dashboard');
}

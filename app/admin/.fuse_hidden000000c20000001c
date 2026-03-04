import type { Metadata } from 'next';
import './admin.css';
import { getAdminRole } from './_lib/auth';
import { AdminShell } from '@/components/admin/admin-shell';

export const metadata: Metadata = {
  title: 'SPLARO Admin',
  description: 'Luxury commerce administration console.',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await getAdminRole();
  return <AdminShell role={role}>{children}</AdminShell>;
}

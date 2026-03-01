import { cookies } from 'next/headers';
import type { AdminRole } from './types';

const ROLE_ORDER: AdminRole[] = ['SUPER_ADMIN', 'EDITOR', 'VIEWER'];

const normalizeRole = (raw: string): AdminRole => {
  const value = String(raw || '').trim().toUpperCase();
  if (value === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (value === 'EDITOR') return 'EDITOR';
  if (value === 'VIEWER') return 'VIEWER';
  return 'SUPER_ADMIN';
};

export async function getAdminRole(): Promise<AdminRole> {
  const store = await cookies();
  return normalizeRole(store.get('splaro_admin_role')?.value || 'SUPER_ADMIN');
}

export function canManage(role: AdminRole, required: AdminRole): boolean {
  const currentIdx = ROLE_ORDER.indexOf(role);
  const requiredIdx = ROLE_ORDER.indexOf(required);
  if (currentIdx === -1 || requiredIdx === -1) return false;
  return currentIdx <= requiredIdx;
}

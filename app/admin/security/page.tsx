import { getAdminRole } from '@/app/admin/_lib/auth';
import { readAdminSetting } from '@/app/admin/_lib/settings-store';
import {
  createSecurityUserAction,
  saveSecurityPolicyAction,
  updateCustomerBlockAction,
  updateCustomerRoleAction,
} from '@/app/admin/module-actions';
import { getDbPool } from '@/lib/db';
import { fallbackStore } from '@/lib/fallbackStore';

type SecurityUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_blocked: boolean;
  created_at: string;
  last_login_at: string | null;
};

type SecurityPolicy = {
  require2FAForAdmins: boolean;
  maxLoginAttempts: number;
  lockoutMinutes: number;
  sessionTimeoutHours: number;
  passwordMinLength: number;
};

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
};

async function loadSecurityData() {
  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    const users: SecurityUserRow[] = mem.users
      .filter((row) => row.role !== 'user')
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        is_blocked: Boolean(row.is_blocked),
        created_at: row.created_at,
        last_login_at: null,
      }));
    const auditRows: AuditRow[] = mem.auditLogs.slice(0, 80).map((row) => ({
      id: String(row.id),
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      created_at: row.created_at,
    }));
    return { users, auditRows, storage: 'fallback' as const };
  }

  let users: SecurityUserRow[] = [];
  let auditRows: AuditRow[] = [];

  try {
    const [usersRows] = await db.execute(
      `SELECT id, name, email, role, is_blocked, created_at, last_login_at
      FROM users
      WHERE role <> 'user'
      ORDER BY created_at DESC
      LIMIT 120`,
    );
    users = (Array.isArray(usersRows) ? usersRows : []).map((row: any) => ({
      id: String(row.id || ''),
      name: String(row.name || ''),
      email: String(row.email || ''),
      role: String(row.role || 'staff'),
      is_blocked: Boolean(Number(row.is_blocked) || row.is_blocked),
      created_at: String(row.created_at || ''),
      last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    }));
  } catch {
    users = [];
  }

  try {
    const [auditRowsRaw] = await db.execute(
      `SELECT id, action, entity_type, entity_id, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 120`,
    );
    auditRows = (Array.isArray(auditRowsRaw) ? auditRowsRaw : []).map((row: any) => ({
      id: String(row.id || ''),
      action: String(row.action || ''),
      entity_type: String(row.entity_type || ''),
      entity_id: String(row.entity_id || ''),
      created_at: String(row.created_at || ''),
    }));
  } catch {
    auditRows = [];
  }

  return { users, auditRows, storage: 'mysql' as const };
}

export default async function AdminSecurityPage() {
  const role = await getAdminRole();
  const canManage = role === 'SUPER_ADMIN';
  const [policy, data] = await Promise.all([
    readAdminSetting<SecurityPolicy>('security_policy_settings', {
      require2FAForAdmins: false,
      maxLoginAttempts: 6,
      lockoutMinutes: 15,
      sessionTimeoutHours: 24,
      passwordMinLength: 8,
    }),
    loadSecurityData(),
  ]);

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <p className="admin-kicker">Security</p>
        <h2 className="admin-heading mt-2 text-[#f6e8ca]">Users, Roles & Audit</h2>
        <p className="mt-3 max-w-3xl text-sm text-[#9d927c]">
          Manage admin access, role policies and governance logs from one secure control room.
        </p>
        <div className="mt-4 inline-flex rounded-full border border-[#3c311d] bg-[#120f09] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#c9b07a]">
          Role: {role.replace('_', ' ')} • Storage: {data.storage}
        </div>
      </section>

      <section className="admin-panel-card p-6">
        <p className="admin-kicker">Access Policy</p>
        <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">Security Rules</h3>
        <form action={saveSecurityPolicyAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 py-2 text-sm text-[#ccb989]">
            <input type="checkbox" name="require2FAForAdmins" defaultChecked={Boolean(policy.require2FAForAdmins)} className="h-4 w-4" disabled={!canManage} />
            Require 2FA for admin roles
          </label>
          <input className="admin-input" name="maxLoginAttempts" type="number" min={3} defaultValue={policy.maxLoginAttempts || 6} placeholder="Max login attempts" disabled={!canManage} />
          <input className="admin-input" name="lockoutMinutes" type="number" min={1} defaultValue={policy.lockoutMinutes || 15} placeholder="Lockout minutes" disabled={!canManage} />
          <input className="admin-input" name="sessionTimeoutHours" type="number" min={1} defaultValue={policy.sessionTimeoutHours || 24} placeholder="Session timeout hours" disabled={!canManage} />
          <input className="admin-input" name="passwordMinLength" type="number" min={8} defaultValue={policy.passwordMinLength || 8} placeholder="Password min length" disabled={!canManage} />
          <button type="submit" className="admin-button admin-button-primary justify-center md:col-span-2 xl:col-span-4" disabled={!canManage}>
            Save Security Policy
          </button>
        </form>
      </section>

      <section className="admin-panel-card p-6">
        <p className="admin-kicker">Admin Accounts</p>
        <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">Create Staff / Admin User</h3>
        <form action={createSecurityUserAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className="admin-input" name="name" placeholder="Full name" required disabled={!canManage} />
          <input className="admin-input" name="email" type="email" placeholder="Email" required disabled={!canManage} />
          <select className="admin-select" name="role" defaultValue="staff" disabled={!canManage}>
            <option value="staff">Staff</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="admin-button admin-button-primary justify-center" disabled={!canManage}>
            Create User
          </button>
        </form>
      </section>

      <section className="admin-panel-card p-5 md:p-6">
        <div className="mb-4">
          <p className="admin-kicker">Role Matrix</p>
          <h3 className="text-lg font-semibold text-[#f3e5c2]">Privileged Users</h3>
        </div>

        <div className="overflow-auto rounded-xl border border-[#342a17]">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[#110f0c] text-[#958667] text-[10px] uppercase tracking-[0.22em]">
              <tr>
                <th className="px-3 py-3 text-left">User</th>
                <th className="px-3 py-3 text-left">Role</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Last Login</th>
                <th className="px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id} className="border-t border-[#2a2317]">
                  <td className="px-3 py-3 text-[#e7d8b8]">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-[#8f826a]">{user.email}</p>
                  </td>
                  <td className="px-3 py-3 text-[#d6c29b] uppercase">{user.role}</td>
                  <td className="px-3 py-3">
                    <span className={user.is_blocked ? 'admin-status-down rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]' : 'admin-status-ok rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]'}>
                      {user.is_blocked ? 'Blocked' : 'Active'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#9d917c]">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={updateCustomerRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <select className="admin-select min-w-[130px]" name="role" defaultValue={user.role} disabled={!canManage}>
                          <option value="user">User</option>
                          <option value="staff">Staff</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button type="submit" className="admin-button admin-button-secondary" disabled={!canManage}>Role</button>
                      </form>
                      <form action={updateCustomerBlockAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="blocked" value={user.is_blocked ? 'false' : 'true'} />
                        <button type="submit" className="admin-button admin-button-secondary" disabled={!canManage}>
                          {user.is_blocked ? 'Unblock' : 'Block'}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {data.users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#8c8069]">
                    No privileged users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel-card p-5 md:p-6">
        <div className="mb-4">
          <p className="admin-kicker">Audit Log</p>
          <h3 className="text-lg font-semibold text-[#f3e5c2]">Recent Security Events</h3>
        </div>
        <div className="overflow-auto rounded-xl border border-[#342a17]">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[#110f0c] text-[#958667] text-[10px] uppercase tracking-[0.22em]">
              <tr>
                <th className="px-3 py-3 text-left">Action</th>
                <th className="px-3 py-3 text-left">Entity</th>
                <th className="px-3 py-3 text-left">ID</th>
                <th className="px-3 py-3 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.auditRows.map((log) => (
                <tr key={log.id} className="border-t border-[#2a2317]">
                  <td className="px-3 py-3 text-[#e6d8b9]">{log.action}</td>
                  <td className="px-3 py-3 text-[#cdbb95]">{log.entity_type}</td>
                  <td className="px-3 py-3 text-[#bca781]">{log.entity_id}</td>
                  <td className="px-3 py-3 text-[#968a74]">{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {data.auditRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[#8c8069]">
                    No audit records yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

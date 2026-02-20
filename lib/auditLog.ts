import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';

type AuditEvent = {
  action: string;
  actor: string;
  requestId: string;
  ip: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  at: string;
};

const auditPath = path.join(process.cwd(), '.cache', 'admin-audit.log');

export async function appendAuditLog(event: Omit<AuditEvent, 'at'>): Promise<void> {
  const entry: AuditEvent = {
    ...event,
    at: new Date().toISOString(),
  };

  await mkdir(path.dirname(auditPath), { recursive: true });
  await appendFile(auditPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

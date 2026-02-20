import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { batchReadTabs } from './sheets';
import { logError, logInfo } from './logger';

export type OrderSnapshotRow = {
  order_id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  district: string;
  thana: string;
  product_name: string;
  product_url: string;
  image_url: string;
  quantity: string;
  notes: string;
  status: string;
  _search: string;
};

export type UserSnapshotRow = {
  user_id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  district: string;
  thana: string;
  address: string;
  source: string;
  verified: string;
  _search: string;
};

export type SubscriptionSnapshotRow = {
  sub_id: string;
  created_at: string;
  email: string;
  consent: string;
  source: string;
  _search: string;
};

export type AdminSnapshot = {
  lastSyncTime: number;
  rows: {
    orders: OrderSnapshotRow[];
    users: UserSnapshotRow[];
    subscriptions: SubscriptionSnapshotRow[];
  };
  indexes: {
    ordersById: Record<string, number>;
    usersByEmail: Record<string, number[]>;
    usersByPhone: Record<string, number[]>;
    subsByEmail: Record<string, number[]>;
  };
};

const DEFAULT_REFRESH_SECONDS = 180;
const snapshotPath = path.join(process.cwd(), '.cache', 'admin-sheet-snapshot.json');

let snapshotState: AdminSnapshot = {
  lastSyncTime: 0,
  rows: {
    orders: [],
    users: [],
    subscriptions: [],
  },
  indexes: {
    ordersById: {},
    usersByEmail: {},
    usersByPhone: {},
    subsByEmail: {},
  },
};

let diskLoaded = false;
let refreshLock: Promise<AdminSnapshot> | null = null;
let schedulerStarted = false;

function refreshIntervalMs(): number {
  const configured = Number(process.env.SHEETS_REFRESH_INTERVAL_SECONDS || DEFAULT_REFRESH_SECONDS);
  const bounded = Math.min(300, Math.max(60, Number.isFinite(configured) ? configured : DEFAULT_REFRESH_SECONDS));
  return bounded * 1000;
}

function staleAfterMs(): number {
  const configured = Number(process.env.SHEETS_STALE_SECONDS || 120);
  const bounded = Math.min(300, Math.max(30, Number.isFinite(configured) ? configured : 120));
  return bounded * 1000;
}

function ensureSearchText(values: Array<string | undefined>): string {
  return values
    .map((value) => (value || '').toLowerCase().trim())
    .filter(Boolean)
    .join(' ');
}

function normalizeOrderRow(row: Record<string, string>): OrderSnapshotRow {
  return {
    order_id: row.order_id || row.id || '',
    created_at: row.created_at || '',
    name: row.name || row.customer_name || '',
    email: row.email || row.customer_email || '',
    phone: row.phone || '',
    address: row.address || '',
    district: row.district || '',
    thana: row.thana || '',
    product_name: row.product_name || '',
    product_url: row.product_url || '',
    image_url: row.image_url || '',
    quantity: row.quantity || '1',
    notes: row.notes || '',
    status: (row.status || 'PENDING').toUpperCase(),
    _search: ensureSearchText([
      row.order_id,
      row.id,
      row.name,
      row.customer_name,
      row.email,
      row.customer_email,
      row.phone,
      row.status,
      row.product_name,
    ]),
  };
}

function normalizeUserRow(row: Record<string, string>): UserSnapshotRow {
  return {
    user_id: row.user_id || row.id || '',
    created_at: row.created_at || '',
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    district: row.district || '',
    thana: row.thana || '',
    address: row.address || '',
    source: row.source || 'web',
    verified: row.verified || 'false',
    _search: ensureSearchText([row.user_id, row.id, row.name, row.email, row.phone, row.district, row.thana]),
  };
}

function normalizeSubscriptionRow(row: Record<string, string>): SubscriptionSnapshotRow {
  return {
    sub_id: row.sub_id || row.id || '',
    created_at: row.created_at || '',
    email: row.email || '',
    consent: row.consent || 'false',
    source: row.source || 'footer',
    _search: ensureSearchText([row.sub_id, row.id, row.email, row.source]),
  };
}

function buildIndexes(snapshot: Omit<AdminSnapshot, 'indexes'>): AdminSnapshot['indexes'] {
  const ordersById: Record<string, number> = {};
  const usersByEmail: Record<string, number[]> = {};
  const usersByPhone: Record<string, number[]> = {};
  const subsByEmail: Record<string, number[]> = {};

  snapshot.rows.orders.forEach((row, index) => {
    if (row.order_id) ordersById[row.order_id] = index;
  });

  snapshot.rows.users.forEach((row, index) => {
    const email = row.email.toLowerCase();
    const phone = row.phone.toLowerCase();
    if (email) {
      usersByEmail[email] = usersByEmail[email] || [];
      usersByEmail[email].push(index);
    }
    if (phone) {
      usersByPhone[phone] = usersByPhone[phone] || [];
      usersByPhone[phone].push(index);
    }
  });

  snapshot.rows.subscriptions.forEach((row, index) => {
    const email = row.email.toLowerCase();
    if (email) {
      subsByEmail[email] = subsByEmail[email] || [];
      subsByEmail[email].push(index);
    }
  });

  return {
    ordersById,
    usersByEmail,
    usersByPhone,
    subsByEmail,
  };
}

async function persistSnapshot(snapshot: AdminSnapshot): Promise<void> {
  await mkdir(path.dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, JSON.stringify(snapshot), 'utf8');
}

async function loadSnapshotFromDisk(): Promise<void> {
  if (diskLoaded) return;
  diskLoaded = true;

  try {
    const raw = await readFile(snapshotPath, 'utf8');
    const parsed = JSON.parse(raw) as AdminSnapshot;
    if (parsed && parsed.rows && parsed.indexes) {
      snapshotState = parsed;
      logInfo('snapshot_loaded_from_disk', {
        orders: parsed.rows.orders.length,
        users: parsed.rows.users.length,
        subscriptions: parsed.rows.subscriptions.length,
      });
    }
  } catch {
    // no prior snapshot is acceptable
  }
}

async function buildSnapshotFromSheets(): Promise<AdminSnapshot> {
  const [ordersTab, usersTab, subsTab] = await batchReadTabs(['ORDERS', 'USERS', 'SUBSCRIPTIONS']);

  const rows = {
    orders: (ordersTab?.rows || []).map(normalizeOrderRow),
    users: (usersTab?.rows || []).map(normalizeUserRow),
    subscriptions: (subsTab?.rows || []).map(normalizeSubscriptionRow),
  };

  const base = {
    lastSyncTime: Date.now(),
    rows,
  };

  return {
    ...base,
    indexes: buildIndexes(base),
  };
}

export async function getSnapshot(): Promise<AdminSnapshot> {
  await loadSnapshotFromDisk();
  return snapshotState;
}

export async function refreshSnapshot(): Promise<AdminSnapshot> {
  await loadSnapshotFromDisk();

  if (refreshLock) {
    return refreshLock;
  }

  refreshLock = (async () => {
    try {
      const refreshed = await buildSnapshotFromSheets();
      snapshotState = refreshed;
      await persistSnapshot(refreshed);
      logInfo('snapshot_refreshed', {
        orders: refreshed.rows.orders.length,
        users: refreshed.rows.users.length,
        subscriptions: refreshed.rows.subscriptions.length,
      });
      return refreshed;
    } catch (error) {
      logError('snapshot_refresh_failed', {
        error: error instanceof Error ? error.message : String(error),
        last_good_snapshot_age_seconds: getSnapshotAgeSeconds(snapshotState),
      });
      return snapshotState;
    } finally {
      refreshLock = null;
    }
  })();

  return refreshLock;
}

export async function triggerBackgroundRefreshIfStale(): Promise<void> {
  const current = await getSnapshot();
  const ageMs = Date.now() - current.lastSyncTime;
  if (ageMs <= staleAfterMs()) return;

  if (!refreshLock) {
    void refreshSnapshot();
  }
}

export function getSnapshotAgeSeconds(snapshot: AdminSnapshot): number {
  if (!snapshot.lastSyncTime) return Number.MAX_SAFE_INTEGER;
  return Math.floor((Date.now() - snapshot.lastSyncTime) / 1000);
}

export function startSnapshotScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const interval = setInterval(() => {
    void refreshSnapshot();
  }, refreshIntervalMs());

  if (typeof interval.unref === 'function') interval.unref();
}

export async function updateOrderStatusInSnapshot(orderId: string, status: string): Promise<boolean> {
  const snapshot = await getSnapshot();
  const index = snapshot.indexes.ordersById[orderId];
  if (index === undefined) return false;

  snapshot.rows.orders[index] = {
    ...snapshot.rows.orders[index],
    status: status.toUpperCase(),
    _search: ensureSearchText([
      snapshot.rows.orders[index].order_id,
      snapshot.rows.orders[index].name,
      snapshot.rows.orders[index].email,
      snapshot.rows.orders[index].phone,
      status,
      snapshot.rows.orders[index].product_name,
    ]),
  };
  snapshot.lastSyncTime = Date.now();
  snapshotState = snapshot;
  await persistSnapshot(snapshot);
  return true;
}

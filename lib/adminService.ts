import { getCacheStore } from './cache';
import {
  getSnapshot,
  getSnapshotAgeSeconds,
  startSnapshotScheduler,
  triggerBackgroundRefreshIfStale,
  type AdminSnapshot,
  type OrderSnapshotRow,
  type SubscriptionSnapshotRow,
  type UserSnapshotRow,
} from './snapshotStore';

const LIST_TTL_SECONDS = 45;
const COUNT_TTL_SECONDS = 90;

type ListParams = {
  page: number;
  pageSize: number;
  q: string;
};

type OrderListParams = ListParams & {
  status?: string;
};

type ListResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  cacheHit: boolean;
  snapshotAgeSeconds: number;
  lastSyncTime: number;
};

function paginate<T>(items: T[], page: number, pageSize: number): ListResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
    cacheHit: false,
    snapshotAgeSeconds: 0,
    lastSyncTime: 0,
  };
}

function normalizeQ(q: string): string {
  return q.trim().toLowerCase();
}

function normalizeStatus(status?: string): string {
  return (status || '').trim().toUpperCase();
}

function listKey(prefix: 'orders' | 'users' | 'subs', params: ListParams, status = ''): string {
  const safeQ = encodeURIComponent(normalizeQ(params.q));
  const safeStatus = encodeURIComponent(normalizeStatus(status));
  return `${prefix}:list:page:${params.page}:size:${params.pageSize}:q:${safeQ}:status:${safeStatus}`;
}

function queryOrders(snapshot: AdminSnapshot, params: OrderListParams): OrderSnapshotRow[] {
  const q = normalizeQ(params.q);
  const status = normalizeStatus(params.status);

  let rows = snapshot.rows.orders;

  if (status) {
    rows = rows.filter((row) => row.status === status);
  }

  if (!q) return rows;

  const exactIndex = snapshot.indexes.ordersById[q] ?? snapshot.indexes.ordersById[params.q];
  if (exactIndex !== undefined) {
    const exactRow = snapshot.rows.orders[exactIndex];
    if (!status || exactRow.status === status) return [exactRow];
  }

  return rows.filter((row) => row._search.includes(q));
}

function queryUsers(snapshot: AdminSnapshot, params: ListParams): UserSnapshotRow[] {
  const q = normalizeQ(params.q);
  if (!q) return snapshot.rows.users;

  const exactByEmail = snapshot.indexes.usersByEmail[q];
  if (exactByEmail?.length) {
    return exactByEmail.map((idx) => snapshot.rows.users[idx]);
  }

  const exactByPhone = snapshot.indexes.usersByPhone[q];
  if (exactByPhone?.length) {
    return exactByPhone.map((idx) => snapshot.rows.users[idx]);
  }

  return snapshot.rows.users.filter((row) => row._search.includes(q));
}

function querySubscriptions(snapshot: AdminSnapshot, params: ListParams): SubscriptionSnapshotRow[] {
  const q = normalizeQ(params.q);
  if (!q) return snapshot.rows.subscriptions;

  const exactByEmail = snapshot.indexes.subsByEmail[q];
  if (exactByEmail?.length) {
    return exactByEmail.map((idx) => snapshot.rows.subscriptions[idx]);
  }

  return snapshot.rows.subscriptions.filter((row) => row._search.includes(q));
}

async function withSnapshot<T>(fn: (snapshot: AdminSnapshot, ageSeconds: number) => T): Promise<T> {
  startSnapshotScheduler();
  const snapshot = await getSnapshot();
  const age = getSnapshotAgeSeconds(snapshot);
  void triggerBackgroundRefreshIfStale();
  return fn(snapshot, age);
}

export async function getOrdersList(params: OrderListParams): Promise<ListResult<OrderSnapshotRow>> {
  const cache = await getCacheStore();
  const key = listKey('orders', params, params.status);

  const cached = await cache.get<Omit<ListResult<OrderSnapshotRow>, 'cacheHit'>>(key);
  if (cached) {
    return { ...cached, cacheHit: true };
  }

  const computed = await withSnapshot((snapshot, age) => {
    const filtered = queryOrders(snapshot, params);
    const pageResult = paginate(filtered, params.page, params.pageSize);
    return {
      ...pageResult,
      snapshotAgeSeconds: age,
      lastSyncTime: snapshot.lastSyncTime,
    };
  });

  await cache.set(key, computed, LIST_TTL_SECONDS);
  return { ...computed, cacheHit: false };
}

export async function getUsersList(params: ListParams): Promise<ListResult<UserSnapshotRow>> {
  const cache = await getCacheStore();
  const key = listKey('users', params);

  const cached = await cache.get<Omit<ListResult<UserSnapshotRow>, 'cacheHit'>>(key);
  if (cached) {
    return { ...cached, cacheHit: true };
  }

  const computed = await withSnapshot((snapshot, age) => {
    const filtered = queryUsers(snapshot, params);
    const pageResult = paginate(filtered, params.page, params.pageSize);
    return {
      ...pageResult,
      snapshotAgeSeconds: age,
      lastSyncTime: snapshot.lastSyncTime,
    };
  });

  await cache.set(key, computed, LIST_TTL_SECONDS);
  return { ...computed, cacheHit: false };
}

export async function getSubscriptionsList(params: ListParams): Promise<ListResult<SubscriptionSnapshotRow>> {
  const cache = await getCacheStore();
  const key = listKey('subs', params);

  const cached = await cache.get<Omit<ListResult<SubscriptionSnapshotRow>, 'cacheHit'>>(key);
  if (cached) {
    return { ...cached, cacheHit: true };
  }

  const computed = await withSnapshot((snapshot, age) => {
    const filtered = querySubscriptions(snapshot, params);
    const pageResult = paginate(filtered, params.page, params.pageSize);
    return {
      ...pageResult,
      snapshotAgeSeconds: age,
      lastSyncTime: snapshot.lastSyncTime,
    };
  });

  await cache.set(key, computed, LIST_TTL_SECONDS);
  return { ...computed, cacheHit: false };
}

export async function getAdminMetrics(): Promise<{
  counts: { orders: number; users: number; subscriptions: number };
  recentOrders: OrderSnapshotRow[];
  cacheHit: boolean;
  snapshotAgeSeconds: number;
  lastSyncTime: number;
}> {
  const cache = await getCacheStore();
  const [ordersCountCached, usersCountCached, subsCountCached, lastUpdatedCached] = await Promise.all([
    cache.get<number>('orders:count'),
    cache.get<number>('users:count'),
    cache.get<number>('subs:count'),
    cache.get<number>('orders:lastUpdatedAt'),
  ]);

  if (
    ordersCountCached !== null &&
    usersCountCached !== null &&
    subsCountCached !== null &&
    lastUpdatedCached !== null
  ) {
    const snapshot = await getSnapshot();
    return {
      counts: {
        orders: ordersCountCached,
        users: usersCountCached,
        subscriptions: subsCountCached,
      },
      recentOrders: snapshot.rows.orders.slice(0, 5),
      cacheHit: true,
      snapshotAgeSeconds: getSnapshotAgeSeconds(snapshot),
      lastSyncTime: lastUpdatedCached,
    };
  }

  const computed = await withSnapshot((snapshot, age) => ({
    counts: {
      orders: snapshot.rows.orders.length,
      users: snapshot.rows.users.length,
      subscriptions: snapshot.rows.subscriptions.length,
    },
    recentOrders: snapshot.rows.orders.slice(0, 5),
    snapshotAgeSeconds: age,
    lastSyncTime: snapshot.lastSyncTime,
  }));

  await Promise.all([
    cache.set('orders:count', computed.counts.orders, COUNT_TTL_SECONDS),
    cache.set('users:count', computed.counts.users, COUNT_TTL_SECONDS),
    cache.set('subs:count', computed.counts.subscriptions, COUNT_TTL_SECONDS),
    cache.set('orders:lastUpdatedAt', computed.lastSyncTime, COUNT_TTL_SECONDS),
  ]);

  return { ...computed, cacheHit: false };
}

export async function invalidateOrderCaches(): Promise<void> {
  const cache = await getCacheStore();
  await Promise.all([
    cache.del('orders:count'),
    cache.del('orders:lastUpdatedAt'),
  ]);
}

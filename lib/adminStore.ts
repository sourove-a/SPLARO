export type CampaignStatus = 'Draft' | 'Active' | 'Paused' | 'Completed';
export type AudienceSegmentType = 'ALL_USERS' | 'NEW_SIGNUPS_7D' | 'INACTIVE_30D' | 'VIP_USERS';
export type JobType = 'TEST' | 'SEND_NOW' | 'SCHEDULED';
export type JobStatus = 'QUEUED' | 'SENT' | 'FAILED';

export type AudienceSegment = {
  type: AudienceSegmentType;
  district?: string;
  thana?: string;
  vipMinOrders?: number;
  vipMinSpend?: number;
};

export type Campaign = {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  segment: AudienceSegment;
  targetCount: number;
  pulsePercent: number;
  scheduleTime: string;
  automated: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  last_run_at?: string;
};

export type NotificationJob = {
  id: string;
  campaignId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  totalRecipients: number;
  created_at: string;
  updated_at: string;
};

export type NotificationLog = {
  id: string;
  campaignId: string;
  jobId: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  status: 'SENT' | 'SKIPPED';
  created_at: string;
};

export type StoreUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  district?: string;
  thana?: string;
  createdAt?: string;
};

export type StoreOrder = {
  id: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  phone?: string;
  district?: string;
  thana?: string;
  total: number;
  createdAt?: string;
  items?: Array<{ name?: string; product?: { name?: string } }>;
};

type StoreShape = {
  campaigns: Campaign[];
  notificationJobs: NotificationJob[];
  notificationLogs: NotificationLog[];
  users: StoreUser[];
  orders: StoreOrder[];
};

const STORE_KEY = 'splaro-admin-campaign-store-v1';
const isBrowser = typeof window !== 'undefined';

let initialized = false;
let state: StoreShape = {
  campaigns: [],
  notificationJobs: [],
  notificationLogs: [],
  users: [],
  orders: [],
};

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

function normalizeDate(input?: string): number {
  if (!input) return 0;
  const t = new Date(input).getTime();
  return Number.isFinite(t) ? t : 0;
}

function initStore(): void {
  if (initialized) return;
  initialized = true;

  if (!isBrowser) return;

  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    state = {
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
      notificationJobs: Array.isArray(parsed.notificationJobs) ? parsed.notificationJobs : [],
      notificationLogs: Array.isArray(parsed.notificationLogs) ? parsed.notificationLogs : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    };
  } catch {
    // ignore corrupt cache
  }
}

function persist(): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function scorePulse(base: number): number {
  const n = Math.max(0, Math.min(100, Math.round(base)));
  return n;
}

export function setAudienceData(users: StoreUser[], orders: StoreOrder[]): void {
  initStore();
  state.users = Array.isArray(users) ? users : [];
  state.orders = Array.isArray(orders) ? orders : [];
  persist();
}

function userMatchesGeo(user: StoreUser, segment: AudienceSegment): boolean {
  const district = (segment.district || '').trim().toLowerCase();
  const thana = (segment.thana || '').trim().toLowerCase();

  if (!district && !thana) return true;

  const orderForUser = state.orders.find((order) =>
    (order.userId && order.userId === user.id) ||
    order.customerEmail.toLowerCase() === user.email.toLowerCase(),
  );

  const userDistrict = String(user.district || orderForUser?.district || '').toLowerCase();
  const userThana = String(user.thana || orderForUser?.thana || '').toLowerCase();

  if (district && userDistrict !== district) return false;
  if (thana && userThana !== thana) return false;
  return true;
}

function selectUsersBySegment(segment: AudienceSegment): StoreUser[] {
  initStore();
  const now = Date.now();
  const users = state.users.filter((u) => userMatchesGeo(u, segment));

  if (segment.type === 'ALL_USERS') return users;

  if (segment.type === 'NEW_SIGNUPS_7D') {
    const threshold = now - 7 * 24 * 60 * 60 * 1000;
    return users.filter((user) => normalizeDate(user.createdAt) >= threshold);
  }

  if (segment.type === 'INACTIVE_30D') {
    const threshold = now - 30 * 24 * 60 * 60 * 1000;
    return users.filter((user) => {
      const recentOrder = state.orders.some((order) => {
        const linked = (order.userId && order.userId === user.id) || order.customerEmail.toLowerCase() === user.email.toLowerCase();
        return linked && normalizeDate(order.createdAt) >= threshold;
      });
      return !recentOrder;
    });
  }

  const minOrders = segment.vipMinOrders ?? 3;
  const minSpend = segment.vipMinSpend ?? 50000;
  return users.filter((user) => {
    const relatedOrders = state.orders.filter((order) =>
      (order.userId && order.userId === user.id) || order.customerEmail.toLowerCase() === user.email.toLowerCase(),
    );
    const count = relatedOrders.length;
    const spend = relatedOrders.reduce((acc, order) => acc + Number(order.total || 0), 0);
    return count >= minOrders || spend >= minSpend;
  });
}

export function computeSegmentTargetCount(segment: AudienceSegment): number {
  return selectUsersBySegment(segment).length;
}

export function listCampaigns(params?: {
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
  q?: string;
  status?: CampaignStatus | '';
}): {
  items: Campaign[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  initStore();
  const page = Math.max(1, Number(params?.page || 1));
  const pageSize = Math.max(1, Math.min(100, Number(params?.pageSize || 20)));
  const includeDeleted = Boolean(params?.includeDeleted);
  const q = String(params?.q || '').trim().toLowerCase();
  const status = String(params?.status || '').trim();

  let rows = state.campaigns.slice();
  if (!includeDeleted) rows = rows.filter((row) => !row.deleted_at);
  if (status) rows = rows.filter((row) => row.status === status);
  if (q) {
    rows = rows.filter((row) =>
      row.name.toLowerCase().includes(q) ||
      row.description.toLowerCase().includes(q),
    );
  }

  rows.sort((a, b) => normalizeDate(b.created_at) - normalizeDate(a.created_at));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export function getCampaign(id: string): Campaign | null {
  initStore();
  return state.campaigns.find((item) => item.id === id && !item.deleted_at) || null;
}

export function createCampaign(input: {
  name: string;
  description?: string;
  status?: CampaignStatus;
  segment: AudienceSegment;
  pulsePercent?: number;
  scheduleTime?: string;
  automated?: boolean;
}): Campaign {
  initStore();
  const now = new Date().toISOString();
  const campaign: Campaign = {
    id: uid('cmp'),
    name: input.name.trim() || 'Untitled campaign',
    description: String(input.description || '').trim(),
    status: input.status || 'Draft',
    segment: input.segment,
    targetCount: computeSegmentTargetCount(input.segment),
    pulsePercent: scorePulse(Number(input.pulsePercent ?? 0)),
    scheduleTime: input.scheduleTime || now,
    automated: Boolean(input.automated),
    created_at: now,
    updated_at: now,
  };

  state.campaigns.unshift(campaign);
  persist();
  return campaign;
}

export function updateCampaign(
  id: string,
  patch: Partial<Omit<Campaign, 'id' | 'created_at'>>,
): Campaign | null {
  initStore();
  const idx = state.campaigns.findIndex((item) => item.id === id && !item.deleted_at);
  if (idx < 0) return null;

  const current = state.campaigns[idx];
  const nextSegment = patch.segment || current.segment;
  const next: Campaign = {
    ...current,
    ...patch,
    segment: nextSegment,
    pulsePercent: patch.pulsePercent != null ? scorePulse(Number(patch.pulsePercent)) : current.pulsePercent,
    targetCount: computeSegmentTargetCount(nextSegment),
    updated_at: new Date().toISOString(),
  };

  state.campaigns[idx] = next;
  persist();
  return next;
}

export function softDeleteCampaign(id: string): Campaign | null {
  return updateCampaign(id, {
    status: 'Completed',
    deleted_at: new Date().toISOString(),
  });
}

export function duplicateCampaign(id: string): Campaign | null {
  const source = getCampaign(id);
  if (!source) return null;
  return createCampaign({
    name: `${source.name} copy`,
    description: source.description,
    status: 'Draft',
    segment: source.segment,
    pulsePercent: source.pulsePercent,
    scheduleTime: source.scheduleTime,
    automated: source.automated,
  });
}

export function createJob(input: {
  campaignId: string;
  type: JobType;
  totalRecipients: number;
}): NotificationJob {
  initStore();
  const now = new Date().toISOString();
  const job: NotificationJob = {
    id: uid('job'),
    campaignId: input.campaignId,
    type: input.type,
    status: 'QUEUED',
    progress: 0,
    totalRecipients: Math.max(0, Number(input.totalRecipients || 0)),
    created_at: now,
    updated_at: now,
  };
  state.notificationJobs.unshift(job);
  persist();
  return job;
}

export function markJobStatus(
  jobId: string,
  status: JobStatus,
  progress: number,
): NotificationJob | null {
  initStore();
  const idx = state.notificationJobs.findIndex((job) => job.id === jobId);
  if (idx < 0) return null;
  const updated: NotificationJob = {
    ...state.notificationJobs[idx],
    status,
    progress: scorePulse(progress),
    updated_at: new Date().toISOString(),
  };
  state.notificationJobs[idx] = updated;
  persist();
  return updated;
}

function buildRecipientRows(segment: AudienceSegment, limit = 20): Array<{ name: string; email: string; phone: string }> {
  const selected = selectUsersBySegment(segment).slice(0, limit);
  if (selected.length > 0) {
    return selected.map((user) => ({
      name: user.name || 'User',
      email: user.email,
      phone: user.phone || '-',
    }));
  }

  return Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
    name: `Sample user ${i + 1}`,
    email: `sample${i + 1}@example.com`,
    phone: `0170000${String(i).padStart(4, '0')}`,
  }));
}

export function listLogs(campaignId?: string): NotificationLog[] {
  initStore();
  const rows = campaignId
    ? state.notificationLogs.filter((log) => log.campaignId === campaignId)
    : state.notificationLogs;
  return rows.slice().sort((a, b) => normalizeDate(b.created_at) - normalizeDate(a.created_at));
}

export function listJobs(campaignId?: string): NotificationJob[] {
  initStore();
  const rows = campaignId
    ? state.notificationJobs.filter((job) => job.campaignId === campaignId)
    : state.notificationJobs;
  return rows.slice().sort((a, b) => normalizeDate(b.created_at) - normalizeDate(a.created_at));
}

function appendDeliveryLogs(campaignId: string, jobId: string, recipients: Array<{ name: string; email: string; phone: string }>): NotificationLog[] {
  const now = new Date().toISOString();
  const logs: NotificationLog[] = recipients.map((recipient) => ({
    id: uid('log'),
    campaignId,
    jobId,
    recipientName: recipient.name,
    recipientEmail: recipient.email,
    recipientPhone: recipient.phone,
    status: 'SENT',
    created_at: now,
  }));
  state.notificationLogs = [...logs, ...state.notificationLogs];
  return logs;
}

export function sendCampaign(campaignId: string, mode: JobType): {
  campaign: Campaign;
  job: NotificationJob;
  logs: NotificationLog[];
} | null {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;

  const recipients = buildRecipientRows(campaign.segment, mode === 'TEST' ? 1 : 20);
  const job = createJob({
    campaignId,
    type: mode,
    totalRecipients: recipients.length,
  });

  markJobStatus(job.id, 'QUEUED', 35);
  const logs = appendDeliveryLogs(campaign.id, job.id, recipients);
  const sentJob = markJobStatus(job.id, 'SENT', 100) || job;

  const nextStatus: CampaignStatus = campaign.status === 'Draft' ? 'Active' : campaign.status;
  const nextCampaign = updateCampaign(campaign.id, {
    status: nextStatus,
    pulsePercent: Math.max(campaign.pulsePercent, Math.min(100, 70 + Math.round(Math.random() * 25))),
    last_run_at: new Date().toISOString(),
  }) || campaign;

  persist();
  return {
    campaign: nextCampaign,
    job: sentJob,
    logs,
  };
}

export function runAutomationTick(): number {
  initStore();
  const now = Date.now();
  let executed = 0;

  state.campaigns.forEach((campaign) => {
    if (campaign.deleted_at) return;
    if (!campaign.automated) return;
    if (campaign.status !== 'Active') return;

    const scheduleTime = normalizeDate(campaign.scheduleTime);
    if (!scheduleTime || scheduleTime > now) return;

    const lastRun = normalizeDate(campaign.last_run_at);
    if (lastRun && now - lastRun < 5 * 60 * 1000) return;

    const sent = sendCampaign(campaign.id, 'SCHEDULED');
    if (sent) executed += 1;
  });

  return executed;
}

export function searchAll(q: string): {
  users: StoreUser[];
  orders: StoreOrder[];
  campaigns: Campaign[];
} {
  initStore();
  const term = q.trim().toLowerCase();
  if (!term) {
    return { users: [], orders: [], campaigns: [] };
  }

  const users = state.users
    .filter((user) =>
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      String(user.phone || '').toLowerCase().includes(term),
    )
    .slice(0, 25);

  const orders = state.orders
    .filter((order) => {
      const productName = Array.isArray(order.items)
        ? order.items.map((item) => item?.product?.name || item?.name || '').join(' ')
        : '';
      return (
        order.id.toLowerCase().includes(term) ||
        order.customerEmail.toLowerCase().includes(term) ||
        String(order.phone || '').toLowerCase().includes(term) ||
        productName.toLowerCase().includes(term)
      );
    })
    .slice(0, 25);

  const campaigns = state.campaigns
    .filter((campaign) => !campaign.deleted_at)
    .filter((campaign) =>
      campaign.name.toLowerCase().includes(term) ||
      campaign.status.toLowerCase().includes(term),
    )
    .slice(0, 25);

  return { users, orders, campaigns };
}

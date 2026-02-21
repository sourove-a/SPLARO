export type FallbackUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  district?: string;
  thana?: string;
  address?: string;
  password_hash?: string | null;
  role: 'user' | 'staff' | 'admin';
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
};

export type FallbackProduct = {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  product_type: 'shoe' | 'bag';
  image_url: string;
  product_url: string;
  price: number;
  discount_price?: number;
  stock_quantity?: number;
  variants_json?: string;
  seo_title?: string;
  seo_description?: string;
  meta_keywords?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type FallbackOrderItem = {
  id: number;
  order_id: string;
  product_id?: string;
  product_name: string;
  product_url?: string;
  image_url?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type FallbackOrder = {
  id: string;
  order_no: string;
  user_id?: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
  district?: string;
  thana?: string;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  admin_note?: string;
  is_refund_requested?: boolean;
  is_refunded?: boolean;
  created_at: string;
  updated_at: string;
};

export type FallbackSubscription = {
  id: string;
  email: string;
  consent: boolean;
  source: string;
  created_at: string;
};

export type FallbackSystemLog = {
  id: number;
  event_type: string;
  event_description: string;
  user_id?: string | null;
  ip_address?: string | null;
  created_at: string;
};

export type FallbackAuditLog = {
  id: number;
  actor_id?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json?: string | null;
  after_json?: string | null;
  ip_address?: string | null;
  created_at: string;
};

export type FallbackCampaign = {
  id: string;
  name: string;
  status: 'Draft' | 'Active' | 'Paused' | 'Completed';
  audience_segment: 'ALL_USERS' | 'NEW_SIGNUPS_7D' | 'INACTIVE_30D';
  target_count: number;
  pulse_percent: number;
  schedule_time: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type FallbackCoupon = {
  id: string;
  code: string;
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: number;
  expiry_at?: string | null;
  usage_limit: number;
  used_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const data = {
  users: [] as FallbackUser[],
  products: [] as FallbackProduct[],
  orders: [] as FallbackOrder[],
  orderItems: [] as FallbackOrderItem[],
  subscriptions: [] as FallbackSubscription[],
  campaigns: [] as FallbackCampaign[],
  coupons: [] as FallbackCoupon[],
  siteSettings: {
    store_name: 'SPLARO',
    shipping_fee: 120,
    tax_rate: 0,
    currency: 'BDT',
    maintenance_mode: false,
    smtp: {},
    telegram: {},
    sheets_sync_enabled: false,
  } as Record<string, unknown>,
  systemLogs: [] as FallbackSystemLog[],
  auditLogs: [] as FallbackAuditLog[],
  cartByKey: new Map<string, any[]>(),
  nextOrderSeq: 1,
  nextItemId: 1,
  nextLogId: 1,
  nextAuditId: 1,
  nextCampaignSeq: 1,
  nextCouponSeq: 1,
};

export function fallbackStore() {
  return data;
}

export function nextFallbackOrderNo(): string {
  const seq = data.nextOrderSeq;
  data.nextOrderSeq += 1;
  return `SPL-${String(seq).padStart(6, '0')}`;
}

export function nextFallbackItemId(): number {
  const id = data.nextItemId;
  data.nextItemId += 1;
  return id;
}

export function nextFallbackLogId(): number {
  const id = data.nextLogId;
  data.nextLogId += 1;
  return id;
}

export function nextFallbackAuditId(): number {
  const id = data.nextAuditId;
  data.nextAuditId += 1;
  return id;
}

export function nextFallbackCampaignId(): string {
  const id = `cmp_${String(data.nextCampaignSeq).padStart(5, '0')}`;
  data.nextCampaignSeq += 1;
  return id;
}

export function nextFallbackCouponId(): string {
  const id = `cpn_${String(data.nextCouponSeq).padStart(5, '0')}`;
  data.nextCouponSeq += 1;
  return id;
}

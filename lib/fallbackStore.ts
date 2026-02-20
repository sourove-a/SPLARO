export type FallbackUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  district?: string;
  thana?: string;
  address?: string;
  password_hash?: string | null;
  role: 'user' | 'admin';
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

const data = {
  users: [] as FallbackUser[],
  products: [] as FallbackProduct[],
  orders: [] as FallbackOrder[],
  orderItems: [] as FallbackOrderItem[],
  subscriptions: [] as FallbackSubscription[],
  systemLogs: [] as FallbackSystemLog[],
  auditLogs: [] as FallbackAuditLog[],
  cartByKey: new Map<string, any[]>(),
  nextOrderSeq: 1,
  nextItemId: 1,
  nextLogId: 1,
  nextAuditId: 1,
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

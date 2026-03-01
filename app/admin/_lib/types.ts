export type AdminRole = 'SUPER_ADMIN' | 'EDITOR' | 'VIEWER';

export type DashboardSummary = {
  totalRevenue: number;
  salesToday: number;
  ordersCount: number;
  productsCount: number;
  customersCount: number;
  avgOrderValue: number;
};

export type RevenuePoint = {
  date: string;
  orders: number;
  sales: number;
};

export type AdminOrder = {
  id: string;
  order_no: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  created_at: string;
  updated_at: string;
  admin_note?: string;
  is_refund_requested?: boolean;
  is_refunded?: boolean;
};

export type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  product_type: 'shoe' | 'bag';
  image_url: string;
  product_url: string;
  price: number;
  discount_price?: number | null;
  stock_quantity: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type TopProduct = {
  product_id: string;
  product_name: string;
  units: number;
  revenue: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  storage: 'mysql' | 'fallback';
};

export type IntegrationStatus = 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED';

export type IntegrationSnapshot = {
  key: string;
  name: string;
  category: string;
  enabled: boolean;
  status: IntegrationStatus;
  hint: string;
  lastUpdatedAt: string;
  pending: number;
  retry: number;
  dead: number;
};

export type DashboardSnapshot = {
  summary: DashboardSummary;
  revenue7d: RevenuePoint[];
  recentOrders: AdminOrder[];
  topProducts: TopProduct[];
  storage: 'mysql' | 'fallback';
  mode: 'NORMAL' | 'DEGRADED';
};

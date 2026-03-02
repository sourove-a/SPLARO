import { redirect } from 'next/navigation';

const TAB_MAP: Record<string, string> = {
  products: '/admin/products',
  inventory: '/admin/products',
  orders: '/admin/orders',
  shipments: '/admin/orders',
  customers: '/admin/customers',
  users: '/admin/customers',
  discounts: '/admin/coupons-discounts',
  coupons: '/admin/coupons-discounts',
  reviews: '/admin/reviews-ratings',
  content: '/admin/content',
  slider: '/admin/content',
  campaigns: '/admin/marketing',
  marketing: '/admin/marketing',
  shipping: '/admin/shipping-logistics',
  logistics: '/admin/shipping-logistics',
  payments: '/admin/payments',
  financials: '/admin/payments',
  integrations: '/admin/integrations',
  settings: '/admin/settings',
  security: '/admin/security',
};

const normalize = (value: string | undefined): string => String(value || '').toLowerCase().replace(/[^a-z]/g, '');

export default async function LegacyAdminDashboardRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = normalize(params.tab);
  redirect(TAB_MAP[tab] || '/admin/dashboard');
}

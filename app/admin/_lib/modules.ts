import type { AdminRole } from './types';

export type AdminModule = {
  href: string;
  label: string;
  group: 'Core' | 'Commerce' | 'Growth' | 'Platform';
  description: string;
  minRole: AdminRole;
};

export const ADMIN_MODULES: AdminModule[] = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    group: 'Core',
    description: 'Revenue overview, KPI radar, and operational feed.',
    minRole: 'VIEWER',
  },
  {
    href: '/admin/products',
    label: 'Products',
    group: 'Commerce',
    description: 'Catalog CRUD, variants, stock, CSV import/export, merchandising.',
    minRole: 'EDITOR',
  },
  {
    href: '/admin/orders',
    label: 'Orders',
    group: 'Commerce',
    description: 'Order operations, statuses, refunds, invoices, exports.',
    minRole: 'EDITOR',
  },
  {
    href: '/admin/customers',
    label: 'Customers',
    group: 'Commerce',
    description: 'CRM, segmentation, LTV intelligence, engagement timeline.',
    minRole: 'EDITOR',
  },
  {
    href: '/admin/coupons-discounts',
    label: 'Coupons & Discounts',
    group: 'Commerce',
    description: 'Promo rules, usage limits, stack logic, auto-apply campaigns.',
    minRole: 'EDITOR',
  },
  {
    href: '/admin/reviews-ratings',
    label: 'Reviews & Ratings',
    group: 'Commerce',
    description: 'Moderation queue, anti-fraud, response workflow.',
    minRole: 'EDITOR',
  },
  {
    href: '/admin/content',
    label: 'Content',
    group: 'Growth',
    description: 'Hero slider, CMS pages, blog, draft/publish with revisions.',
    minRole: 'EDITOR',
  },
  {
    href: '/admin/marketing',
    label: 'Marketing',
    group: 'Growth',
    description: 'Lifecycle campaigns, attribution, SEO and social channels.',
    minRole: 'EDITOR',
  },
  {
    href: '/admin/shipping-logistics',
    label: 'Shipping & Logistics',
    group: 'Platform',
    description: 'Zones, rates, Pathao/Steadfast, dispatch SLA and tracking.',
    minRole: 'EDITOR',
  },
  {
    href: '/admin/payments',
    label: 'Payments',
    group: 'Platform',
    description: 'bKash, Nagad, SSLCommerz, COD and reconciliation controls.',
    minRole: 'SUPER_ADMIN',
  },
  {
    href: '/admin/integrations',
    label: 'Integrations',
    group: 'Platform',
    description: 'Live integration matrix, health probes, queue diagnostics.',
    minRole: 'VIEWER',
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    group: 'Platform',
    description: 'General config, tax, currency, email, storefront appearance.',
    minRole: 'SUPER_ADMIN',
  },
  {
    href: '/admin/security',
    label: 'Security',
    group: 'Platform',
    description: 'Admin users, roles, audit logs, session and policy control.',
    minRole: 'SUPER_ADMIN',
  },
];

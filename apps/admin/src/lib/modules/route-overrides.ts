import type { FlatAdminRoute } from '@/lib/navigation/admin-nav'
import type { ModuleKpi, ModuleRecord } from '@/lib/modules/module-data'

export interface RouteTemplate {
  kpis?: ModuleKpi[]
  records?: Omit<ModuleRecord, 'id'>[]
  highlights?: string[]
}

type RecordRow = Omit<ModuleRecord, 'id'>

const R: Record<string, RouteTemplate> = {
  '/dashboard/analytics': {
    kpis: [
      { label: 'Sessions today', value: '2,480', tone: 'gold' },
      { label: 'Conversion', value: '3.42%', tone: 'success' },
      { label: 'Bounce rate', value: '41%', tone: 'warning' },
      { label: 'AOV', value: '৳6,635', tone: 'default' },
    ],
    records: [
      { name: 'Organic search traffic', status: 'active', updated: 'Live', metric: '+18.4%' },
      { name: 'Instagram referral', status: 'active', updated: 'Live', metric: '+23.1%' },
      { name: 'Direct / returning', status: 'active', updated: 'Live', metric: '34% share' },
    ],
    highlights: ['Top landing: /collections/summer-edition', 'Mobile sessions: 72%', 'Peak hour: 8–10 PM'],
  },
  '/dashboard/orders': {
    kpis: [
      { label: 'Today', value: 48, tone: 'gold' },
      { label: 'Pending', value: 24, tone: 'warning' },
      { label: 'Shipped', value: 156, tone: 'success' },
      { label: 'COD risk', value: 6, tone: 'warning' },
    ],
    records: [
      { name: 'SPL-2026-001243 · Fatima A.', status: 'pending', updated: '5m ago', metric: '৳6,450 COD' },
      { name: 'SPL-2026-001242 · Karim H.', status: 'active', updated: '12m ago', metric: '৳12,800 Paid' },
      { name: 'SPL-2026-001241 · Nadia R.', status: 'active', updated: '28m ago', metric: 'Shipped' },
    ],
  },
  '/dashboard/products': {
    kpis: [
      { label: 'Live SKUs', value: 248, tone: 'success' },
      { label: 'Draft', value: 18, tone: 'warning' },
      { label: 'Low stock', value: 12, tone: 'warning' },
      { label: 'Published today', value: 4, tone: 'gold' },
    ],
    records: [
      { name: 'Embroidered Luxury Kurta', status: 'active', updated: '2h ago', metric: '84 units' },
      { name: 'Red Banarasi Saree', status: 'active', updated: '3h ago', metric: '12 units' },
      { name: 'City Runner Sneaker', status: 'pending', updated: '4h ago', metric: 'Low stock' },
    ],
  },
  '/dashboard/collections': {
    kpis: [
      { label: 'Live collections', value: 14, tone: 'success' },
      { label: 'Featured', value: 4, tone: 'gold' },
      { label: 'Draft', value: 2, tone: 'warning' },
      { label: 'Products linked', value: 186, tone: 'default' },
    ],
    records: [
      { name: 'Summer Edition 2026', status: 'active', updated: 'Live', metric: '42 products' },
      { name: 'Eid Luxury Drop', status: 'active', updated: 'Live', metric: '28 products' },
      { name: 'Bridal Edit', status: 'draft', updated: 'Draft', metric: '12 products' },
    ],
  },
  '/dashboard/inventory': {
    kpis: [
      { label: 'Total units', value: '1,240', tone: 'success' },
      { label: 'Low stock', value: 12, tone: 'warning' },
      { label: 'Out of stock', value: 3, tone: 'warning' },
      { label: 'Adjustments today', value: 8, tone: 'default' },
    ],
    records: [
      { name: 'City Runner Sneaker · Size 42', status: 'pending', updated: '1h ago', metric: '2 left' },
      { name: 'Banarasi Saree · Red', status: 'active', updated: '2h ago', metric: '12 units' },
    ],
  },
  '/dashboard/customers': {
    kpis: [
      { label: 'Total customers', value: '8,653', tone: 'success' },
      { label: 'New this week', value: 89, tone: 'gold' },
      { label: 'Repeat buyers', value: '42%', tone: 'success' },
      { label: 'At risk', value: 24, tone: 'warning' },
    ],
    records: [
      { name: 'Fatima Ahmed · Dhaka', status: 'active', updated: '2h ago', metric: '৳84K LTV' },
      { name: 'Karim Hassan · Chittagong', status: 'active', updated: '4h ago', metric: '12 orders' },
    ],
  },
  '/dashboard/campaigns': {
    kpis: [
      { label: 'Active campaigns', value: 6, tone: 'gold' },
      { label: 'Reach', value: '48K', tone: 'success' },
      { label: 'CTR avg', value: '4.2%', tone: 'success' },
      { label: 'Draft', value: 2, tone: 'warning' },
    ],
    records: [
      { name: 'Summer Sale 2026 · Multi-channel', status: 'active', updated: 'Live', metric: '12.4% CTR' },
      { name: 'Eid Luxury Drop · Meta + Email', status: 'active', updated: 'Live', metric: '৳2.1L revenue' },
    ],
  },
  '/dashboard/coupons': {
    kpis: [
      { label: 'Live coupons', value: 12, tone: 'success' },
      { label: 'Redemptions today', value: 34, tone: 'gold' },
      { label: 'Revenue impact', value: '৳42K', tone: 'success' },
      { label: 'Expiring soon', value: 3, tone: 'warning' },
    ],
    records: [
      { name: 'SPLARO20 · 20% off', status: 'active', updated: 'Live', metric: '142 uses' },
      { name: 'VIP-GOLD · Free shipping', status: 'active', updated: 'Live', metric: '28 uses' },
    ],
  },
  '/dashboard/email-sms': {
    kpis: [
      { label: 'Emails sent', value: '4,820', tone: 'gold' },
      { label: 'SMS sent', value: '1,240', tone: 'default' },
      { label: 'Open rate', value: '38.2%', tone: 'success' },
      { label: 'Scheduled', value: 3, tone: 'warning' },
    ],
    records: [
      { name: 'Eid Luxury Drop · Email blast', status: 'active', updated: 'Live', metric: '4,820 sent' },
      { name: 'Abandoned cart SMS · 2h delay', status: 'active', updated: '1h ago', metric: '62% CTR' },
      { name: 'VIP early access · SMS', status: 'pending', updated: 'Draft', metric: 'Fri 9 AM' },
      { name: 'Order shipped · Auto email', status: 'active', updated: 'Live', metric: 'Trigger' },
      { name: 'Welcome series · Email', status: 'active', updated: 'Live', metric: '3-step flow' },
      { name: 'Payment reminder · SMS', status: 'draft', updated: 'Draft', metric: 'Review' },
    ],
    highlights: [
      'Email deliverability: 98.4%',
      'SMS balance: ৳2,400 remaining',
      '3 broadcasts scheduled this week',
    ],
  },
  '/dashboard/whatsapp': {
    kpis: [
      { label: 'Conversations', value: 86, tone: 'gold' },
      { label: 'Broadcasts', value: 4, tone: 'default' },
      { label: 'Response rate', value: '94%', tone: 'success' },
      { label: 'Unread', value: 12, tone: 'warning' },
    ],
    records: [
      { name: 'Order inquiry · 017XX-XXX-123', status: 'pending', updated: '3m ago', metric: 'Unread' },
      { name: 'Eid catalog broadcast', status: 'active', updated: 'Live', metric: '420 sent' },
    ],
  },
  '/dashboard/production/overview': {
    kpis: [
      { label: 'In pipeline', value: 24, tone: 'gold' },
      { label: 'Cutting', value: 8, tone: 'default' },
      { label: 'QC pending', value: 5, tone: 'warning' },
      { label: 'Ready today', value: 12, tone: 'success' },
    ],
    records: [
      { name: 'Summer Kurta Batch · Cutting', status: 'pending', updated: '20m ago', metric: '120 pcs' },
      { name: 'Festive Gharara · Sewing', status: 'active', updated: '1h ago', metric: '85 pcs' },
      { name: 'City Runner Sneaker · QC', status: 'pending', updated: '2h ago', metric: '48 pcs' },
    ],
  },
  '/dashboard/settings': {
    kpis: [
      { label: 'Store settings', value: 24, tone: 'default' },
      { label: 'Payment gateways', value: 3, tone: 'success' },
      { label: 'Shipping zones', value: 8, tone: 'gold' },
      { label: 'Pending review', value: 2, tone: 'warning' },
    ],
    records: [
      { name: 'Store · SPLARO Luxury Fashion', status: 'active', updated: 'Saved', metric: 'General' },
      { name: 'bKash + SSLCommerz + COD', status: 'active', updated: 'Live', metric: 'Payments' },
    ],
    highlights: ['Domain: splaro.co', 'Currency: BDT (৳)', 'Timezone: Asia/Dhaka'],
  },
}

function slugPrefix(label: string): string {
  return label.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'MOD'
}

function generateRouteTemplate(navItem: FlatAdminRoute): RouteTemplate {
  const groupRecords: Record<string, RecordRow[]> = {
    Security: [
      { name: 'Super Admin login', status: 'active', updated: 'Just now', metric: 'Success' },
      { name: 'Role permission update', status: 'active', updated: '1h ago', metric: 'Operations' },
      { name: 'Failed login blocked', status: 'pending', updated: '2h ago', metric: 'IP blocked' },
    ],
    System: [
      { name: 'Store settings saved', status: 'active', updated: '30m ago', metric: 'Settings' },
      { name: 'Telegram sync completed', status: 'active', updated: '1h ago', metric: 'Automation' },
      { name: 'Backup scheduled', status: 'pending', updated: 'Tonight', metric: '02:00 AM' },
    ],
    SaaS: [
      { name: 'splaro.co tenant', status: 'active', updated: 'Live', metric: 'Primary' },
      { name: 'Subscription renewal', status: 'active', updated: '15d left', metric: 'Pro plan' },
      { name: 'Domain SSL renewed', status: 'active', updated: 'Yesterday', metric: 'Auto' },
    ],
    Integrations: [
      { name: 'bKash API', status: 'active', updated: 'Live', metric: '99.9% uptime' },
      { name: 'Steadfast courier', status: 'active', updated: 'Live', metric: 'Connected' },
      { name: 'Meta Business', status: 'pending', updated: 'Review', metric: 'Token refresh' },
    ],
    WMS: [
      { name: 'Dhaka warehouse stock', status: 'active', updated: 'Live', metric: '840 units' },
      { name: 'Transfer to Chittagong', status: 'pending', updated: 'Today', metric: '120 units' },
    ],
    'Company OS': [
      { name: 'Payroll cycle March', status: 'active', updated: 'Processing', metric: '12 staff' },
      { name: 'Task: Summer shoot', status: 'pending', updated: 'Due Fri', metric: 'Marketing' },
    ],
  }

  const rows =
    groupRecords[navItem.group] ??
    Array.from({ length: 5 }, (_, index) => ({
      name: `${navItem.label} record ${index + 1}`,
      status: (['active', 'pending', 'draft', 'active', 'pending'] as const)[index] ?? 'active',
      updated: index === 0 ? 'Just now' : `${index + 1}h ago`,
      metric: `${100 + index * 47}`,
    }))

  const seed = navItem.label.length * 17 + navItem.group.length * 11

  return {
    kpis: [
      { label: 'Total', value: 80 + (seed % 120), tone: 'default' },
      { label: 'Active', value: 20 + (seed % 40), tone: 'success' },
      { label: 'This week', value: 5 + (seed % 15), tone: 'gold' },
      { label: 'Pending', value: 2 + (seed % 10), tone: 'warning' },
    ],
    records: rows,
    highlights: [
      navItem.description ?? `Manage ${navItem.label.toLowerCase()} in SPLARO Commerce OS.`,
      `Module group: ${navItem.group}`,
      'Connected to splaro.co/api/v1 when live.',
    ],
  }
}

export function getRouteTemplate(navItem: FlatAdminRoute): RouteTemplate {
  return R[navItem.href] ?? generateRouteTemplate(navItem)
}

export function getRouteKpis(navItem: FlatAdminRoute): ModuleKpi[] {
  return getRouteTemplate(navItem).kpis ?? []
}

export function getRouteRecords(navItem: FlatAdminRoute, count = 8): ModuleRecord[] {
  const rows = getRouteTemplate(navItem).records ?? []
  return rows.slice(0, count).map((row, index) => ({
    id: `${slugPrefix(navItem.label)}-${1000 + index + 1}`,
    ...row,
  }))
}

export function getRouteHighlights(navItem: FlatAdminRoute): string[] {
  return getRouteTemplate(navItem).highlights ?? []
}

export function getRouteTabs(navItem: FlatAdminRoute): string[] {
  const base = ['Overview', 'Records', 'Activity']
  const group = navItem.group
  if (group === 'Integrations' || group === 'System' || group === 'Security') return [...base, 'Settings']
  if (group === 'Finance' || group === 'Commerce' || group === 'Production' || group === 'Marketing') {
    return [...base, 'Reports']
  }
  if (group === 'Content') return [...base, 'Preview']
  return base
}

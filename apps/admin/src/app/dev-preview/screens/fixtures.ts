/**
 * Sample payloads for the dev-only visual harness at `/__dev/screens`.
 *
 * These exist so the DC screens can be looked at — layout, spacing, dark mode,
 * table behaviour at phone width — without an admin session. They are seeded
 * into a QueryClient that lives only inside the harness, are never imported by
 * anything under `/dashboard`, and the route they serve returns 404 in a
 * production build. No product screen ever reads them.
 */

const now = Date.now()
const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString()

export const procurementOverview = {
  suppliers: [
    {
      id: 's1',
      name: 'Islampur wholesale',
      phone: '01711204556',
      email: 'islampur@example.com',
      dueAmount: 184000,
      paidAmount: 656000,
      isActive: true,
    },
    {
      id: 's2',
      name: 'Tangail handloom',
      phone: '01755903664',
      email: null,
      dueAmount: 0,
      paidAmount: 432000,
      isActive: true,
    },
    {
      id: 's3',
      name: 'Dhaka trims & tags',
      phone: null,
      email: null,
      dueAmount: 12000,
      paidAmount: 108000,
      isActive: false,
    },
  ],
  orders: [
    {
      id: 'p1',
      poNumber: 'PO-0121',
      status: 'ORDERED',
      total: 216000,
      createdAt: iso(3),
      supplier: { name: 'Islampur wholesale' },
      items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }],
    },
    {
      id: 'p2',
      poNumber: 'PO-0118',
      status: 'PENDING',
      total: 144000,
      createdAt: iso(12),
      supplier: { name: 'Tangail handloom' },
      items: [{ id: 'i4' }],
    },
    {
      id: 'p3',
      poNumber: 'PO-0116',
      status: 'RECEIVED',
      total: 96000,
      createdAt: iso(20),
      supplier: { name: 'Islampur wholesale' },
      items: [{ id: 'i5' }, { id: 'i6' }],
    },
  ],
  grns: [
    {
      id: 'g1',
      grnNumber: 'GRN-0112',
      receivedAt: iso(4),
      notes: '24 units, no shortfall',
      purchaseOrder: { poNumber: 'PO-0116', supplier: { name: 'Islampur wholesale' } },
    },
  ],
}

export const returns = [
  {
    id: 'r1',
    rmaNumber: 'RMA-0219',
    orderId: 'o1',
    orderNumber: 'SPL-1036',
    customer: 'Farhana Akter',
    reason: 'Size too small',
    items: 'Noor Embroidered Abaya · M',
    amount: 18600,
    method: 'Refund' as const,
    status: 'pending' as const,
    updated: '2 days ago',
  },
  {
    id: 'r2',
    rmaNumber: 'RMA-0218',
    orderId: 'o2',
    orderNumber: 'SPL-1033',
    customer: 'Sabbir Rahman',
    reason: 'Colour differs from photo',
    items: 'Jamdani Weave Saree',
    amount: 27900,
    method: 'Exchange' as const,
    status: 'approved' as const,
    updated: 'yesterday',
  },
  {
    id: 'r3',
    rmaNumber: 'RMA-0217',
    orderId: 'o3',
    orderNumber: 'SPL-1029',
    customer: 'Tasnia Haque',
    reason: 'Damaged in transit',
    items: 'Rimjhim Chiffon Gown',
    amount: 19400,
    method: 'Refund' as const,
    status: 'received' as const,
    updated: '3 hours ago',
  },
  {
    id: 'r4',
    rmaNumber: 'RMA-0215',
    orderId: 'o4',
    orderNumber: 'SPL-1024',
    customer: 'Zarin Tasnim',
    reason: 'Changed her mind',
    items: 'Zohra Pearl Clutch',
    amount: 0,
    method: 'Store credit' as const,
    status: 'rejected' as const,
    updated: '4 days ago',
  },
]

export const wmsOverview = {
  warehouses: [
    {
      id: 'w1',
      name: 'Banani main',
      code: 'BAN-01',
      city: 'Dhaka',
      address: null,
      isActive: true,
      zones: [
        { racks: [{ bins: [{ availableQty: 1842, reservedQty: 142, damagedQty: 11 }] }] },
        { racks: [{ bins: [{ availableQty: 240, reservedQty: 0, damagedQty: 0 }] }] },
      ],
    },
    {
      id: 'w2',
      name: 'Chattogram hub',
      code: 'CTG-04',
      city: 'Chattogram',
      address: null,
      isActive: true,
      zones: [],
    },
  ],
  movements: [
    {
      id: 'm1',
      sku: 'SPL-KFT-014',
      reason: 'SALE',
      delta: -2,
      quantityBefore: 44,
      quantityAfter: 42,
      note: 'SPL-1038 packed',
      createdAt: iso(0),
    },
    {
      id: 'm2',
      sku: 'SPL-KRT-337',
      reason: 'PURCHASE',
      delta: 36,
      quantityBefore: 0,
      quantityAfter: 36,
      note: 'GRN-0112',
      createdAt: iso(1),
    },
    {
      id: 'm3',
      sku: 'SPL-ABY-221',
      reason: 'DAMAGE',
      delta: -3,
      quantityBefore: 35,
      quantityAfter: 32,
      note: 'water damage in transit',
      createdAt: iso(2),
    },
  ],
  transfers: [
    {
      id: 't1',
      status: 'IN_TRANSIT',
      notes: '24 units, shipped 2 days ago',
      createdAt: iso(2),
      fromWarehouse: { name: 'Banani main' },
      toWarehouse: { name: 'Uttara pop-up' },
      items: [{ id: 'ti1' }],
    },
    {
      id: 't2',
      status: 'PENDING',
      notes: '36 units, not shipped yet',
      createdAt: iso(0),
      fromWarehouse: { name: 'Islampur intake' },
      toWarehouse: { name: 'Banani main' },
      items: [{ id: 'ti2' }],
    },
  ],
  stockSummary: { available: 2418, reserved: 186, damaged: 24 },
}

export const coupons = {
  total: 4,
  coupons: [
    {
      id: 'c1',
      code: 'EID10',
      type: 'PERCENTAGE' as const,
      value: 10,
      minOrderAmount: null,
      maxDiscountAmount: null,
      usageLimit: 500,
      usedCount: 218,
      isActive: true,
      startsAt: null,
      expiresAt: new Date(now + 4 * 86_400_000).toISOString(),
    },
    {
      id: 'c2',
      code: 'WELCOME2',
      type: 'FIXED_AMOUNT' as const,
      value: 300,
      minOrderAmount: 2000,
      maxDiscountAmount: null,
      usageLimit: null,
      usedCount: 92,
      isActive: true,
      startsAt: null,
      expiresAt: null,
    },
    {
      id: 'c3',
      code: 'FREEDEL',
      type: 'FREE_SHIPPING' as const,
      value: 0,
      minOrderAmount: 3000,
      maxDiscountAmount: null,
      usageLimit: 200,
      usedCount: 178,
      isActive: true,
      startsAt: null,
      expiresAt: new Date(now + 40 * 86_400_000).toISOString(),
    },
    {
      id: 'c4',
      code: 'RAMADAN20',
      type: 'PERCENTAGE' as const,
      value: 20,
      minOrderAmount: null,
      maxDiscountAmount: 2000,
      usageLimit: 400,
      usedCount: 341,
      isActive: false,
      startsAt: null,
      expiresAt: iso(90),
    },
  ],
}

export const campaigns = [
  {
    id: 'k1',
    name: 'Eid Edit launch',
    type: 'EMAIL',
    status: 'SENT',
    subject: 'The Eid Edit is live — hand-finished in Dhaka',
    recipientType: 'ALL',
    totalSent: 4820,
    totalDelivered: 4712,
    totalOpened: 1284,
    totalClicked: 342,
    scheduledAt: null,
    sentAt: iso(6),
    createdAt: iso(8),
  },
  {
    id: 'k2',
    name: 'Winter preview teaser',
    type: 'SMS',
    status: 'SCHEDULED',
    subject: 'Winter drops Thursday',
    recipientType: 'LOYAL',
    totalSent: 0,
    totalDelivered: 0,
    totalOpened: 0,
    totalClicked: 0,
    scheduledAt: new Date(now + 2 * 86_400_000).toISOString(),
    sentAt: null,
    createdAt: iso(1),
  },
  {
    id: 'k3',
    name: 'VIP early access',
    type: 'WHATSAPP',
    status: 'DRAFT',
    subject: null,
    recipientType: 'HIGH_SPENDERS',
    totalSent: 0,
    totalDelivered: 0,
    totalOpened: 0,
    totalClicked: 0,
    scheduledAt: null,
    sentAt: null,
    createdAt: iso(2),
  },
]

export const campaignStats = {
  byStatus: [{ status: 'SENT', _count: 1 }],
  byType: [{ type: 'EMAIL', _count: 1 }],
  totalSent: 4820,
  totalOpened: 1284,
  totalClicked: 342,
  openRate: 26.6,
  clickRate: 7.1,
}

export const marketingOverview = {
  affiliates: [],
  campaigns: [],
  whatsappLogs: [],
  whatsappCampaigns: [],
  emailCampaigns: [],
  emailLogs: [],
  smsLogs: [
    {
      id: 'sm1',
      recipient: '01533907221',
      subject: null,
      body: 'আপনার SPLARO অর্ডার কনফার্ম হয়েছে। COD ডেলিভারির আগে কল আসবে।',
      status: 'DELIVERED',
      createdAt: iso(0),
    },
    {
      id: 'sm2',
      recipient: '01711204556',
      subject: null,
      body: 'Your SPLARO parcel is out for delivery today.',
      status: 'SENT',
      createdAt: iso(0),
    },
    {
      id: 'sm3',
      recipient: '1755903664',
      subject: null,
      body: 'Order shipped',
      status: 'FAILED',
      createdAt: iso(1),
    },
  ],
}

export const sheetsDashboard = {
  sheets: [
    {
      sheetType: 'ORDERS',
      configured: true,
      configuredVia: 'workspace' as const,
      lastSync: iso(0),
      lastStatus: 'COMPLETED',
      lastError: null,
    },
    {
      sheetType: 'HISAB',
      configured: true,
      configuredVia: 'env' as const,
      lastSync: iso(1),
      lastStatus: 'FAILED',
      lastError: 'Google API error 429: Quota exceeded for quota metric "Write requests"',
    },
    {
      sheetType: 'STOCK',
      configured: false,
      configuredVia: null,
      lastSync: null,
      lastStatus: null,
      lastError: null,
    },
  ],
  stats: { total: 3, configured: 2, completed: 1, failed: 1, pending: 0 },
  connection: {
    workspaceConnected: true,
    spreadsheetLinked: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/example',
    googleEmail: 'splaro.bd@gmail.com',
    autoSyncEnabled: true,
    tokenHealth: 'HEALTHY',
    setupHref: '/dashboard/all-integrations',
  },
}

export const syncLogs = {
  items: [
    {
      id: 'j1',
      jobType: 'ORDERS_EXPORT',
      sheetTab: 'Orders',
      status: 'COMPLETED',
      rowNumber: 1042,
      errorMsg: null,
      retryCount: 0,
      syncedAt: iso(0),
      triggeredBy: 'cron',
      createdAt: iso(0),
    },
    {
      id: 'j2',
      jobType: 'DAILY_FINANCE',
      sheetTab: 'Hisab',
      status: 'FAILED',
      rowNumber: null,
      errorMsg: 'Google API error 429: Quota exceeded for quota metric "Write requests"',
      retryCount: 2,
      syncedAt: null,
      triggeredBy: 'splaro.bd@gmail.com',
      createdAt: iso(1),
    },
  ],
  total: 2,
  page: 1,
}

export const financeDashboard = {
  totals: { revenue: 2140800, expense: 412600, netProfit: 682400, dailyNetProfit: 24800 },
  partners: [
    { id: 'pa1', name: 'Rifat Hasan', slug: 'rifat', currentBalance: 307080, sharePercent: 45 },
    { id: 'pa2', name: 'Mahmud Alam', slug: 'mahmud', currentBalance: 238840, sharePercent: 35 },
    { id: 'pa3', name: 'Sumaiya Khan', slug: 'sumaiya', currentBalance: -13648, sharePercent: 20 },
  ],
  pendingApprovals: 3,
  recentActivity: [],
  expensesByCategory: [
    { category: 'Salary and wages', amount: 186000 },
    { category: 'Marketing · Meta ads', amount: 112400 },
    { category: 'Packaging', amount: 48200 },
    { category: 'Rent and utilities', amount: 45000 },
    { category: 'Other khoroch', amount: 21000 },
  ],
}

export const profitLoss = {
  period: { from: iso(30), to: iso(0) },
  totals: {
    grossRevenue: 2140800,
    productCost: 918400,
    courierCost: 127400,
    packagingCost: 48200,
    paymentGatewayFee: 19640,
    discount: 184600,
    returnLoss: 96500,
    netProfit: 746060,
  },
  orderCount: 1157,
}

export const dashboardStats = {
  revenue: { value: 2140800, change: 12.6 },
  orders: { value: 1157, change: -14.2 },
  customers: { value: 842, change: 8.1 },
  avgOrderValue: { value: 1850, change: -2.1 },
  alerts: { codRiskOrders: 4, failedPayments: 2 },
}

export const dashboardInsights = {
  topCategories: [
    { id: 'cat1', name: 'Abaya · Signature', image: null, revenue: 1284000, orders: 312, share: 60 },
    { id: 'cat2', name: 'Kaftan · Eid Edit', image: null, revenue: 486000, orders: 148, share: 22.7 },
    { id: 'cat3', name: 'Saree · Heritage', image: null, revenue: 370800, orders: 96, share: 17.3 },
  ],
  topProducts: [
    {
      rank: 1,
      id: 'pr1',
      name: 'Meherjaan Silk Kaftan',
      sku: 'SPL-KFT-014',
      sold: 186,
      revenue: 684200,
      trend: 18.4,
    },
    {
      rank: 2,
      id: 'pr2',
      name: 'Noor Embroidered Abaya',
      sku: 'SPL-ABY-221',
      sold: 142,
      revenue: 512400,
      trend: -6.2,
    },
    {
      rank: 3,
      id: 'pr3',
      name: 'Rangeen Cotton Kurti',
      sku: 'SPL-KRT-337',
      sold: 98,
      revenue: 196000,
      trend: 0,
    },
  ],
  paymentMix: [
    { name: 'Cash on delivery', value: 612, revenue: 1184200, count: 612 },
    { name: 'bKash', value: 318, revenue: 612400, count: 318 },
    { name: 'SSLCommerz', value: 164, revenue: 284600, count: 164 },
  ],
  paymentMixTotal: 1094,
  recentActivities: [
    { id: 'a1', type: 'order' as const, message: 'SPL-1038 placed by Farhana Akter', at: iso(0) },
    { id: 'a2', type: 'payment' as const, message: 'bKash payment failed on SPL-1037', at: iso(0) },
    { id: 'a3', type: 'shipping' as const, message: '9 parcels handed to Steadfast', at: iso(1) },
  ],
}

export const ordersList = {
  orders: [
    {
      id: 'o1',
      invoiceNumber: 'SPL-1038',
      shippingName: 'Farhana Akter',
      shippingPhone: '01733448275',
      shippingCity: 'Dhaka',
      total: 18600,
      status: 'PROCESSING',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      isCodRisk: true,
      createdAt: iso(0),
      updatedAt: iso(0),
      items: [],
    },
    {
      id: 'o2',
      invoiceNumber: 'SPL-1037',
      shippingName: 'Sabbir Rahman',
      shippingPhone: '01755903664',
      shippingCity: 'Chattogram',
      total: 27900,
      status: 'PACKED',
      paymentMethod: 'bKash',
      paymentStatus: 'PAID',
      isCodRisk: false,
      createdAt: iso(1),
      updatedAt: iso(0),
      items: [],
    },
    {
      id: 'o3',
      invoiceNumber: 'SPL-1035',
      shippingName: 'Tasnia Haque',
      shippingPhone: '01611902774',
      shippingCity: 'Dhaka',
      total: 19400,
      status: 'SHIPPED',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      isCodRisk: false,
      createdAt: iso(2),
      updatedAt: iso(1),
      items: [],
    },
    {
      id: 'o4',
      invoiceNumber: 'SPL-1030',
      shippingName: 'Nabila Karim',
      shippingPhone: '01912330118',
      shippingCity: 'Sylhet',
      total: 6800,
      status: 'DELIVERED',
      paymentMethod: 'SSLCommerz',
      paymentStatus: 'PAID',
      isCodRisk: false,
      createdAt: iso(6),
      updatedAt: iso(3),
      items: [],
    },
  ],
  total: 4,
  page: 1,
  totalPages: 1,
}

/** Deliberately mixed: a VIP, a repeat buyer, a blocked account, and two
 *  zero-order throwaways of the kind the delete sweep exists to clear. */
export const customersList = {
  customers: [
    {
      id: 'c1',
      firstName: 'Farhana',
      lastName: 'Akter',
      phone: '01711204556',
      email: 'farhana@example.com',
      loyaltyTier: 'PLATINUM',
      totalOrders: 14,
      totalSpent: 184200,
      avgOrderValue: 13157,
      codRiskScore: 8,
      vipScore: 92,
      createdAt: iso(120),
      lastOrderDate: iso(2),
      isBlocked: false,
    },
    {
      id: 'c2',
      firstName: 'Sadia',
      lastName: 'Rahman',
      phone: '01755903664',
      email: null,
      loyaltyTier: 'GOLD',
      totalOrders: 5,
      totalSpent: 46800,
      avgOrderValue: 9360,
      codRiskScore: 22,
      vipScore: 54,
      createdAt: iso(88),
      lastOrderDate: iso(9),
      isBlocked: false,
    },
    {
      id: 'c3',
      firstName: 'Rakib',
      lastName: 'Hasan',
      phone: '01822114466',
      email: 'rakib@example.com',
      loyaltyTier: 'BRONZE',
      totalOrders: 3,
      totalSpent: 12400,
      avgOrderValue: 4133,
      codRiskScore: 71,
      vipScore: 11,
      createdAt: iso(40),
      lastOrderDate: iso(14),
      isBlocked: true,
    },
    {
      id: 'c4',
      firstName: 'Test',
      lastName: 'Order',
      phone: '01300000001',
      email: null,
      loyaltyTier: 'BRONZE',
      totalOrders: 0,
      totalSpent: 0,
      avgOrderValue: 0,
      codRiskScore: 0,
      vipScore: 0,
      createdAt: iso(3),
      lastOrderDate: null,
      isBlocked: false,
    },
    {
      id: 'c5',
      firstName: 'Asdf',
      lastName: '',
      phone: '01300000002',
      email: null,
      loyaltyTier: 'BRONZE',
      totalOrders: 0,
      totalSpent: 0,
      avgOrderValue: 0,
      codRiskScore: 0,
      vipScore: 0,
      createdAt: iso(1),
      lastOrderDate: null,
      isBlocked: false,
    },
  ],
  total: 5,
}

export const productsList = {
  products: [
    {
      id: 'pr1',
      name: 'Meherjaan Silk Kaftan',
      sku: 'SPL-KFT-014',
      basePrice: 3680,
      isPublished: true,
      status: 'PUBLISHED',
      lowStockThreshold: 5,
      category: { id: 'cat1', name: 'Kaftan · Eid Edit' },
      _count: { variants: 4 },
      variants: [{ stock: 12 }, { stock: 9 }, { stock: 6 }, { stock: 4 }],
    },
    {
      id: 'pr2',
      name: 'Noor Embroidered Abaya',
      sku: 'SPL-ABY-221',
      basePrice: 4290,
      isPublished: true,
      status: 'PUBLISHED',
      lowStockThreshold: 5,
      category: { id: 'cat2', name: 'Abaya · Signature' },
      _count: { variants: 3 },
      variants: [{ stock: 2 }, { stock: 1 }, { stock: 0 }],
    },
    {
      id: 'pr3',
      name: 'Rangeen Cotton Kurti',
      sku: 'SPL-KRT-337',
      basePrice: 1980,
      isPublished: false,
      status: 'DRAFT',
      lowStockThreshold: 5,
      category: null,
      _count: { variants: 2 },
      variants: [{ stock: 24 }, { stock: 18 }],
    },
    {
      id: 'pr4',
      name: 'Sample upload — delete me',
      sku: null,
      basePrice: 0,
      isPublished: false,
      status: 'DRAFT',
      lowStockThreshold: 5,
      category: null,
      _count: { variants: 0 },
      variants: [],
    },
  ],
  total: 4,
  page: 1,
  totalPages: 1,
}

/** One of each severity, so the tray's colour rules are all exercised. */
export const notificationsOverview = {
  logs: [
    {
      id: 'n1',
      channel: 'IN_APP',
      recipient: '/dashboard/orders/SPL-1038',
      subject: 'New order · SPL-1038',
      body: 'Farhana Akter · ৳4,290 · Cash on delivery',
      status: 'DELIVERED',
      level: 'critical' as const,
      createdAt: new Date(now - 4 * 60_000).toISOString(),
    },
    {
      id: 'n2',
      channel: 'IN_APP',
      recipient: '/dashboard/inventory',
      subject: 'Low stock: SPL-ABY-221',
      body: 'Noor Embroidered Abaya (SPL-ABY-221) — only 1 left',
      status: 'DELIVERED',
      level: 'warn' as const,
      createdAt: new Date(now - 46 * 60_000).toISOString(),
    },
    {
      id: 'n3',
      channel: 'IN_APP',
      recipient: '/dashboard/automation/google-sheets-sync',
      subject: 'Google Sheets sync failed: order',
      body: 'Request had insufficient authentication scopes',
      status: 'DELIVERED',
      level: 'critical' as const,
      createdAt: new Date(now - 2 * 3_600_000).toISOString(),
    },
    {
      id: 'n4',
      channel: 'IN_APP',
      recipient: '/dashboard/customers?search=01755903664',
      subject: 'New customer · Sadia Rahman',
      body: '01755903664 · Website signup',
      status: 'DELIVERED',
      level: 'info' as const,
      createdAt: new Date(now - 5 * 3_600_000).toISOString(),
    },
    {
      id: 'n5',
      channel: 'SMS',
      recipient: '01711204556',
      subject: 'Order shipped SPL-1035',
      body: 'Your parcel is on the way',
      status: 'FAILED',
      level: 'info' as const,
      createdAt: new Date(now - 9 * 3_600_000).toISOString(),
    },
  ],
  summary: { total: 5, sent: 4, failed: 1, pending: 0, critical: 2, deliveredRate: 80 },
}

/** 30 zero-filled days with a believable weekend rhythm, as the API returns them. */
export const revenueSeries = {
  data: Array.from({ length: 30 }, (_, i) => {
    const day = new Date(now - (29 - i) * 86_400_000)
    const weekend = day.getDay() === 5 || day.getDay() === 6
    const base = weekend ? 78_000 : 42_000
    const wobble = ((i * 37) % 23) * 1_400
    const quiet = i === 11 || i === 19
    return {
      date: day.toISOString().slice(0, 10),
      revenue: quiet ? 0 : base + wobble,
      orders: quiet ? 0 : Math.round((base + wobble) / 3_600),
    }
  }),
  period: '30d',
  group: 'day',
}

export const conversionFunnel = {
  period: '30d',
  steps: [
    { label: 'Carts created', count: 1_284 },
    { label: 'Orders placed', count: 1_157 },
    { label: 'Orders confirmed', count: 1_094 },
    { label: 'Delivered', count: 902 },
  ],
}

export const dailyGoal: {
  goal: number | null
  achieved: number
  orders: number
  percent: number | null
  remaining: number | null
} = {
  goal: 150_000,
  achieved: 124_600,
  orders: 34,
  percent: 83,
  remaining: 25_400,
}

export const inventoryAlerts = {
  lowStock: 3,
  outOfStock: 1,
}

export const courierStats = {
  byStatus: [
    { status: 'IN_TRANSIT', _count: 41 },
    { status: 'DELIVERED', _count: 38 },
  ],
  byProvider: [{ provider: 'steadfast', _count: 79 }],
  recentFailed: [
    {
      id: 'f1',
      orderId: 'o9',
      provider: 'steadfast',
      failureReason: 'Invalid recipient phone',
      order: { invoiceNumber: 'SPL-1031', shippingName: 'Rina Akter' },
    },
  ],
}

/** Settings → Payments: one gateway live, one with keys but off, one untouched. */
export const paymentIntegrations = {
  items: [
    {
      provider: 'bkash',
      configured: true,
      source: 'database' as const,
      adminManaged: true,
      fields: {
        appKey: '••••••••',
        appSecret: '••••••••',
        username: 'splaro_live',
        password: '••••••••',
      },
    },
    {
      provider: 'nagad',
      configured: true,
      source: 'env' as const,
      fields: {
        merchantId: '683002007104225',
        merchantNumber: '01905010205',
        publicKey: '••••••••',
        privateKey: '••••••••',
      },
    },
    {
      provider: 'sslcommerz',
      configured: false,
      source: 'none' as const,
      fields: {},
    },
  ],
}

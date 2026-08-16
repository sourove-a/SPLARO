export interface AgentQuickCommand {
  id: string
  label: string
  message: string
  category: 'ops' | 'finance' | 'catalog' | 'health'
}

export const AGENT_QUICK_COMMANDS: AgentQuickCommand[] = [
  {
    id: 'health',
    label: 'আজকের হেলথ',
    message: 'আজকের store health report দাও — order, revenue, low stock, SEO gap, top customer',
    category: 'health',
  },
  {
    id: 'problems',
    label: 'Problem ki?',
    message: 'Full admin health diagnostic চালাও — API, integration, inventory, SEO সমস্যা কী কী?',
    category: 'health',
  },
  {
    id: 'pending-orders',
    label: 'Pending orders',
    message: 'Pending order list দেখাও — invoice, customer, amount সহ',
    category: 'ops',
  },
  {
    id: 'confirm-pending',
    label: 'Confirm pending',
    message: 'Pending orders দেখাও — কোনগুলো confirm করা যায়? Confirm করতে confirm বলতে হবে।',
    category: 'ops',
  },
  {
    id: 'book-courier',
    label: 'Courier book',
    message: 'কোন pending/confirmed order এ courier book করা যায়? Invoice দিয়ে Steadfast book করার flow বলো — confirm লাগবে।',
    category: 'ops',
  },
  {
    id: 'invoice-detail',
    label: 'Invoice detail',
    message: 'Latest order এর detail দাও — invoice, status, customer, payment, courier',
    category: 'ops',
  },
  {
    id: 'phone-lookup',
    label: 'Phone lookup',
    message: 'কোনো phone number দিলে order খুঁজে দিতে পারো? Example: 017… এর order list',
    category: 'ops',
  },
  {
    id: 'integration',
    label: 'Connection check',
    message: 'সব integration status check করো — Steadfast courier, bKash, Telegram, OpenAI',
    category: 'ops',
  },
  {
    id: 'finance',
    label: 'Partner hisab',
    message: 'Partner finance summary — balance, share %, pending withdrawal',
    category: 'finance',
  },
  {
    id: 'stock',
    label: 'Low stock',
    message: 'কোন product এর stock ১০ এর নিচে? list দাও',
    category: 'catalog',
  },
  {
    id: 'seo-gaps',
    label: 'SEO gaps',
    message: 'কত product এ meta title/description missing? list করো',
    category: 'catalog',
  },
  {
    id: 'seo-fix',
    label: 'SEO auto-fix',
    message: 'Missing SEO meta auto-fill করো published product গুলোর জন্য',
    category: 'catalog',
  },
  {
    id: 'top-customers',
    label: 'Top customers',
    message: 'Top 5 customer — order count ও total spend',
    category: 'ops',
  },
  {
    id: 'bulk-courier',
    label: 'বাল্ক কুরিয়ার ডিসপ্যাচ',
    message: 'সব pending ও confirmed order একসাথে Steadfast courier এ book করো',
    category: 'ops',
  },
  {
    id: 'auto-po',
    label: 'অটো পারচেজ অর্ডার',
    message: 'কম স্টক থাকা প্রোডাক্টগুলোর জন্য ড্রাফট Purchase Order (PO) তৈরি করো',
    category: 'catalog',
  },
  {
    id: 'review-reply',
    label: 'রিভিউ অটো-রিপ্লাই',
    message: 'নতুন ও পেন্ডিং কাস্টমার রিভিউগুলো অনুমোদন করো এবং ব্র্যান্ড রিপ্লাই পোস্ট করো',
    category: 'ops',
  },
  {
    id: 'fraud-audit',
    label: 'COD রিটার্ন ও ফ্রড অডিট',
    message: 'পেন্ডিং অর্ডারগুলোর মধ্যে কোনো ফেক ফোন বা হাই-রিস্ক COD অর্ডার আছে কিনা চেক করো',
    category: 'ops',
  },
  {
    id: 'profit-insights',
    label: 'প্রফিট ও মার্জিন বিশ্লেষণ',
    message: 'এই মাসের বিক্রয়, প্রোডাক্ট খরচ ও নেট প্রফিট মার্জিনের বিস্তারিত রিপোর্ট দাও',
    category: 'finance',
  },
  {
    id: 'daily-brief',
    label: 'এক্সিকিউটিভ ডেইলি ব্রিফ',
    message: 'আজকের সেলস, কুরিয়ার ও স্টকের সম্পূর্ণ ডেইলি ব্রিফ তৈরি করো এবং টেলিগ্রামে পাঠাও',
    category: 'health',
  },
]


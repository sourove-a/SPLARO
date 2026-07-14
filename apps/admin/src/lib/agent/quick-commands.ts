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
    id: 'today-sale',
    label: 'আজকের sale',
    message: 'আজ কত order হয়েছে? revenue কত?',
    category: 'ops',
  },
]

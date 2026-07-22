import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

/**
 * Legacy file helpers — DEV ONLY when SPLARO_DEV_FILE_ORDER_CACHE=1.
 * Production auth/orders use Nest + Prisma via BFF (`api-auth`, `api-orders`).
 * Types below are shared by the BFF order/invoice shapeshape — keep them.
 */

const DATA_DIR = path.join(process.cwd(), '.data/splaro')
const ORDERS_FILE = 'orders.json'

let initialized = false

async function ensureDataDir(): Promise<void> {
  if (initialized) return
  await mkdir(DATA_DIR, { recursive: true })
  initialized = true
}

async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)

  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'courier_booked'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'returned'
  | 'cancelled'
  | 'refunded'

export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'

export interface StoredOrderItem {
  productId: string
  variantId?: string
  quantity: number
  name: string
  price: number
  image: string
  size?: string
  color?: string
  slug: string
}

export interface StoredOrder {
  id: string
  invoiceNumber: string
  invoiceAccessKey?: string
  userId?: string
  createdAt: string
  updatedAt: string
  status: OrderStatus
  customer: {
    name: string
    email: string
    phone: string
    address: string
    city: string
  }
  items: StoredOrderItem[]
  subtotal: number
  delivery: number
  discount: number
  couponCode?: string
  couponDiscount?: number
  total: number
  payment: {
    method: string
    status: PaymentStatus
    transactionId?: string
    paidAt?: string
  }
  tracking?: {
    carrier?: string
    trackingNumber?: string
    url?: string
    stage?: string
    updatedAt?: string
    estimatedDelivery?: string
  }
}

/** Dev-only order mirror — no-op callers must gate via SPLARO_DEV_FILE_ORDER_CACHE. */
export async function readOrders(): Promise<StoredOrder[]> {
  return readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
}

export async function writeOrders(orders: StoredOrder[]): Promise<void> {
  await writeJsonFile(ORDERS_FILE, orders)
}

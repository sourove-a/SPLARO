import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), '.data/splaro')

const FILES = {
  users: 'users.json',
  orders: 'orders.json',
  reviews: 'reviews.json',
  resetTokens: 'reset-tokens.json',
  sessions: 'sessions.json',
  stock: 'stock.json',
} as const

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

export interface StoredUser {
  id: string
  name: string
  email: string
  phone: string
  passwordHash: string
  createdAt: string
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

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
  }
}

export interface StoredReview {
  id: string
  productId: string
  userId?: string
  authorName: string
  rating: number
  title?: string
  body: string
  createdAt: string
  verified?: boolean
}

export interface ResetToken {
  token: string
  userId: string
  email: string
  expiresAt: string
  usedAt?: string
}

export interface StoredSession {
  id: string
  userId: string
  createdAt: string
  expiresAt: string
}

export type StockOverlay = Record<string, number>

export async function readUsers(): Promise<StoredUser[]> {
  return readJsonFile<StoredUser[]>(FILES.users, [])
}

export async function writeUsers(users: StoredUser[]): Promise<void> {
  await writeJsonFile(FILES.users, users)
}

export async function readOrders(): Promise<StoredOrder[]> {
  return readJsonFile<StoredOrder[]>(FILES.orders, [])
}

export async function writeOrders(orders: StoredOrder[]): Promise<void> {
  await writeJsonFile(FILES.orders, orders)
}

export async function readReviews(): Promise<StoredReview[]> {
  return readJsonFile<StoredReview[]>(FILES.reviews, [])
}

export async function writeReviews(reviews: StoredReview[]): Promise<void> {
  await writeJsonFile(FILES.reviews, reviews)
}

export async function readResetTokens(): Promise<ResetToken[]> {
  return readJsonFile<ResetToken[]>(FILES.resetTokens, [])
}

export async function writeResetTokens(tokens: ResetToken[]): Promise<void> {
  await writeJsonFile(FILES.resetTokens, tokens)
}

export async function readSessions(): Promise<StoredSession[]> {
  return readJsonFile<StoredSession[]>(FILES.sessions, [])
}

export async function writeSessions(sessions: StoredSession[]): Promise<void> {
  await writeJsonFile(FILES.sessions, sessions)
}

export async function readStock(): Promise<StockOverlay> {
  return readJsonFile<StockOverlay>(FILES.stock, {})
}

export async function writeStock(stock: StockOverlay): Promise<void> {
  await writeJsonFile(FILES.stock, stock)
}

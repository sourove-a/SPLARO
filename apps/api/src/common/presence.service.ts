import { Injectable } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import { RedisService } from './redis.service'
import { resolveStoreId } from './store.util'

const PRESENCE_WINDOW_MS = 30_000
const SESSION_FALLBACK_MS = 5 * 60_000

export type PresenceSource = 'live' | 'sessions'

/**
 * Signed-in shoppers are recorded under this prefix alongside their anonymous
 * visitor id, so the admin can tell *who* is browsing and not merely how many.
 * Written once here and read back through onlineCustomerIds — a second literal
 * anywhere else is how the two halves drift apart.
 */
const CUSTOMER_MEMBER_PREFIX = 'customer:'

export function presenceCustomerMember(customerId: string): string {
  return `${CUSTOMER_MEMBER_PREFIX}${customerId}`
}

export interface PresenceSnapshot {
  storefront: number
  admin: number
  total: number
  source: PresenceSource
  updatedAt: string
}

export interface OnlineAdmin {
  id: string
  name: string
  email: string | null
  avatar: string | null
  role: string
}

export interface OnlineCustomersSnapshot {
  /** Customer ids seen inside the presence window. */
  online: string[]
  source: PresenceSource
  updatedAt: string
}

export interface OnlineAdminsSnapshot {
  admins: OnlineAdmin[]
  storefront: number
  source: PresenceSource
  updatedAt: string
}

@Injectable()
export class PresenceService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  private setKey(storeId: string, channel: 'storefront' | 'admin') {
    return `splaro:presence:${storeId}:${channel}`
  }

  async heartbeat(storeIdRaw: string, visitorId: string, channel: 'storefront' | 'admin'): Promise<void> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    await this.redis.touchPresenceSet(this.setKey(storeId, channel), visitorId, PRESENCE_WINDOW_MS)
  }

  async getPresence(storeIdRaw: string): Promise<PresenceSnapshot> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const updatedAt = new Date().toISOString()

    if (this.redis.isReady) {
      const [storefront, admin] = await Promise.all([
        this.redis.countPresenceSet(this.setKey(storeId, 'storefront'), PRESENCE_WINDOW_MS),
        this.redis.countPresenceSet(this.setKey(storeId, 'admin'), PRESENCE_WINDOW_MS),
      ])
      return {
        storefront,
        admin,
        total: storefront + admin,
        source: 'live',
        updatedAt,
      }
    }

    const since = new Date(Date.now() - SESSION_FALLBACK_MS)
    const sessionWhere = {
      isRevoked: false,
      expiresAt: { gt: new Date() },
      lastActive: { gte: since },
    } as const

    const [admin, storefront] = await Promise.all([
      this.prisma.deviceSession.count({
        where: {
          ...sessionWhere,
          user: { staffRoles: { some: { storeId } } },
        },
      }),
      this.prisma.deviceSession.count({
        where: {
          ...sessionWhere,
          user: {
            customer: { storeId },
            staffRoles: { none: { storeId } },
          },
        },
      }),
    ])

    return {
      storefront,
      admin,
      total: storefront + admin,
      source: 'sessions',
      updatedAt,
    }
  }

  /**
   * Which shoppers are on the site right now. Redis is the live source; when it
   * is down this falls back to device sessions, which is coarser (a session
   * counts as "active" for five minutes) but keeps the dot honest rather than
   * reporting everyone offline.
   */
  async getOnlineCustomers(storeIdRaw: string): Promise<OnlineCustomersSnapshot> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const updatedAt = new Date().toISOString()

    if (this.redis.isReady) {
      const members = await this.redis.listPresenceMembers(
        this.setKey(storeId, 'storefront'),
        PRESENCE_WINDOW_MS,
      )
      const online = members
        .filter((m) => m.startsWith(CUSTOMER_MEMBER_PREFIX))
        .map((m) => m.slice(CUSTOMER_MEMBER_PREFIX.length))
        .filter(Boolean)
      return { online: [...new Set(online)], source: 'live', updatedAt }
    }

    const since = new Date(Date.now() - SESSION_FALLBACK_MS)
    const rows = await this.prisma.customer.findMany({
      where: {
        storeId,
        user: {
          is: {
            deviceSessions: {
              some: { isRevoked: false, expiresAt: { gt: new Date() }, lastActive: { gte: since } },
            },
          },
        },
      },
      select: { id: true },
    })

    return { online: rows.map((r) => r.id), source: 'sessions', updatedAt }
  }

  async getOnlineAdmins(storeIdRaw: string): Promise<OnlineAdminsSnapshot> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const updatedAt = new Date().toISOString()

    if (this.redis.isReady) {
      const [members, storefront] = await Promise.all([
        this.redis.listPresenceMembers(this.setKey(storeId, 'admin'), PRESENCE_WINDOW_MS),
        this.redis.countPresenceSet(this.setKey(storeId, 'storefront'), PRESENCE_WINDOW_MS),
      ])
      const ids = members
        .filter((m) => m.startsWith('admin:'))
        .map((m) => m.slice('admin:'.length))
        .filter(Boolean)
      const users =
        ids.length === 0
          ? []
          : await this.prisma.user.findMany({
              where: { id: { in: ids } },
              select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true },
            })
      return {
        admins: users.map((u) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`.trim(),
          email: u.email,
          avatar: u.avatar,
          role: u.role,
        })),
        storefront,
        source: 'live',
        updatedAt,
      }
    }

    const since = new Date(Date.now() - SESSION_FALLBACK_MS)
    const sessionWhere = {
      isRevoked: false,
      expiresAt: { gt: new Date() },
      lastActive: { gte: since },
    } as const

    const [adminUsers, storefront] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          staffRoles: { some: { storeId } },
          deviceSessions: { some: sessionWhere },
        },
        select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true },
      }),
      this.prisma.deviceSession.count({
        where: {
          ...sessionWhere,
          user: {
            customer: { storeId },
            staffRoles: { none: { storeId } },
          },
        },
      }),
    ])

    return {
      admins: adminUsers.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        avatar: u.avatar,
        role: u.role,
      })),
      storefront,
      source: 'sessions',
      updatedAt,
    }
  }
}

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'

interface TierConfig {
  tier: LoyaltyTier
  minPoints: number
  multiplier: number
  perks: string[]
}

const DEFAULT_TIERS: TierConfig[] = [
  { tier: 'BRONZE', minPoints: 0, multiplier: 1, perks: ['Welcome gift', 'Early sale access'] },
  { tier: 'SILVER', minPoints: 500, multiplier: 1.5, perks: ['Free shipping on ৳1500+', 'Birthday discount 10%'] },
  { tier: 'GOLD', minPoints: 2000, multiplier: 2, perks: ['Free shipping always', 'Birthday discount 15%', 'Priority support'] },
  { tier: 'PLATINUM', minPoints: 5000, multiplier: 2.5, perks: ['Free express shipping', 'Birthday discount 20%', 'Early collection access'] },
  { tier: 'DIAMOND', minPoints: 10000, multiplier: 3, perks: ['Concierge service', 'Birthday discount 25%', 'Exclusive events', 'Free returns'] },
]

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getTierForPoints(storeId: string, points: number): Promise<LoyaltyTier> {
    const configs = await this.prisma.loyaltyTierConfig.findMany({
      where: { storeId },
      orderBy: { minPoints: 'desc' },
    })

    const tiers = configs.length > 0
      ? configs.map(c => ({ tier: c.tier as LoyaltyTier, minPoints: c.minPoints }))
      : DEFAULT_TIERS.map(t => ({ tier: t.tier, minPoints: t.minPoints }))

    const matched = tiers.find(t => points >= t.minPoints)
    return matched?.tier ?? 'BRONZE'
  }

  async awardOrderPoints(customerId: string, orderId: string, orderTotal: number): Promise<number> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { store: { select: { id: true } } },
    })
    if (!customer) throw new Error(`Customer ${customerId} not found`)

    const storeId = customer.storeId
    const tierConfigs = await this.prisma.loyaltyTierConfig.findMany({ where: { storeId } })

    const currentTier = await this.getTierForPoints(storeId, customer.loyaltyPoints)
    const multiplier = Number(tierConfigs.find(c => c.tier === currentTier)?.pointsPerBdt)
      ?? DEFAULT_TIERS.find(t => t.tier === currentTier)?.multiplier
      ?? 1

    // 1 point per ৳10, multiplied by tier
    const pointsEarned = Math.floor((orderTotal / 10) * (multiplier as number))

    const newTotal = customer.loyaltyPoints + pointsEarned
    const newTier = await this.getTierForPoints(storeId, newTotal)

    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: newTotal, loyaltyTier: newTier },
      }),
      this.prisma.loyaltyHistory.create({
        data: {
          customerId,
          points: pointsEarned,
          type: 'EARN',
          reason: `Order reward (${currentTier} tier ×${multiplier})`,
          orderId,
        },
      }),
    ])

    this.logger.log(`Customer ${customerId} earned ${pointsEarned} points. New total: ${newTotal} (${newTier})`)
    return pointsEarned
  }

  async redeemPoints(customerId: string, pointsToRedeem: number, orderId: string): Promise<number> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer) throw new Error('Customer not found')
    if (customer.loyaltyPoints < pointsToRedeem) throw new Error('Insufficient points')

    // 1 point = ৳0.50 discount
    const discountBDT = pointsToRedeem * 0.5
    const newPoints = customer.loyaltyPoints - pointsToRedeem
    const newTier = await this.getTierForPoints(customer.storeId, newPoints)

    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: newPoints, loyaltyTier: newTier },
      }),
      this.prisma.loyaltyHistory.create({
        data: {
          customerId,
          points: -pointsToRedeem,
          type: 'REDEEM',
          reason: `Points redeemed for ৳${discountBDT} discount`,
          orderId,
        },
      }),
    ])

    return discountBDT
  }

  async processReferral(referrerId: string, newCustomerId: string): Promise<void> {
    const existing = await this.prisma.referral.findFirst({
      where: { referrerId, refereeId: newCustomerId },
    })
    if (existing) return

    const referrer = await this.prisma.customer.findUnique({ where: { id: referrerId } })
    if (!referrer) return

    const REFERRAL_POINTS = 200

    await this.prisma.$transaction([
      this.prisma.referral.create({
        data: {
          referrerId,
          refereeId: newCustomerId,
          code: `${referrer.referralCode ?? referrerId}-${newCustomerId}`.slice(0, 64),
          isConverted: true,
          rewardPoints: REFERRAL_POINTS,
          convertedAt: new Date(),
        },
      }),
      this.prisma.customer.update({
        where: { id: referrerId },
        data: { loyaltyPoints: { increment: REFERRAL_POINTS } },
      }),
      this.prisma.loyaltyHistory.create({
        data: { customerId: referrerId, points: REFERRAL_POINTS, type: 'REFERRAL', reason: `Referral bonus — new customer joined` },
      }),
    ])

    this.logger.log(`Referral processed: ${referrerId} → ${newCustomerId} (+${REFERRAL_POINTS} pts)`)
  }

  async getLoyaltySummary(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyPoints: true, loyaltyTier: true, storeId: true },
    })
    if (!customer) throw new Error('Customer not found')

    const nextTier = DEFAULT_TIERS.find(t => t.minPoints > customer.loyaltyPoints)
    const currentTierConfig = DEFAULT_TIERS.find(t => t.tier === customer.loyaltyTier)

    const history = await this.prisma.loyaltyHistory.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return {
      points: customer.loyaltyPoints,
      tier: customer.loyaltyTier,
      perks: currentTierConfig?.perks ?? [],
      redeemableValue: Math.floor(customer.loyaltyPoints * 0.5),
      nextTier: nextTier
        ? { tier: nextTier.tier, pointsNeeded: nextTier.minPoints - customer.loyaltyPoints }
        : null,
      history,
    }
  }

  async awardBirthdayPoints(storeId: string): Promise<number> {
    const today = new Date()
    const month = today.getMonth() + 1
    const day = today.getDate()

    const customers = await this.prisma.customer.findMany({
      where: {
        storeId,
        birthday: {
          not: null,
        },
      },
      select: { id: true, birthday: true, loyaltyPoints: true },
    })

    let awarded = 0
    const BIRTHDAY_POINTS = 500

    for (const c of customers) {
      if (!c.birthday) continue
      const dob = new Date(c.birthday)
      if (dob.getMonth() + 1 === month && dob.getDate() === day) {
        await this.prisma.$transaction([
          this.prisma.customer.update({
            where: { id: c.id },
            data: { loyaltyPoints: { increment: BIRTHDAY_POINTS } },
          }),
          this.prisma.loyaltyHistory.create({
            data: { customerId: c.id, points: BIRTHDAY_POINTS, type: 'BONUS', reason: 'Birthday bonus gift' },
          }),
        ])
        awarded++
      }
    }

    if (awarded > 0) this.logger.log(`Birthday points awarded to ${awarded} customers`)
    return awarded
  }
}

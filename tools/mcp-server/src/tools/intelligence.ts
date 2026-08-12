import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { money, reply, replyError } from '../format.ts'
import { prisma, storeId } from '../prisma.ts'

export function registerIntelligenceTools(server: McpServer): void {
  // 1. COD Risk Assessor
  server.registerTool(
    'assess_cod_risk',
    {
      title: 'Assess Cash-on-Delivery (COD) Risk',
      description:
        'Analyzes customer phone number and location to compute COD Risk Score (LOW, MEDIUM, HIGH, CRITICAL). Answers "is this COD order safe?", "check buyer risk".',
      inputSchema: {
        phone: z.string().describe('Customer Bangladesh phone number e.g. 01712345678'),
        district: z.string().optional().describe('Delivery district e.g. Dhaka, Chittagong, Sylhet'),
      },
    },
    async ({ phone, district }) => {
      const store = await storeId()
      const cleanPhone = phone.replace(/[^0-9]/g, '')

      if (cleanPhone.length < 10) {
        return replyError('Invalid phone number provided. Must contain at least 10 digits.')
      }

      const normalizedPhone = cleanPhone.slice(-10)

      const orders = await prisma().order.findMany({
        where: {
          storeId: store,
          shippingPhone: { contains: normalizedPhone },
        },
        select: {
          id: true,
          status: true,
          total: true,
          createdAt: true,
          paymentMethod: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      const totalOrders = orders.length
      const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length
      const cancelledCount = orders.filter((o) => o.status === 'CANCELLED').length
      const returnedCount = orders.filter((o) => o.status === 'RETURNED').length

      let riskScore: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
      const riskFactors: string[] = []

      if (totalOrders === 0) {
        riskScore = 'MEDIUM'
        riskFactors.push('First-time customer — no previous order history.')
      } else {
        const failureRate = (cancelledCount + returnedCount) / totalOrders
        if (returnedCount > 0) {
          riskScore = 'HIGH'
          riskFactors.push(`Customer has ${returnedCount} returned order(s) in history.`)
        }
        if (failureRate >= 0.5 && totalOrders >= 2) {
          riskScore = 'CRITICAL'
          riskFactors.push(`High failure/cancellation rate (${Math.round(failureRate * 100)}%).`)
        }
        if (deliveredCount >= 2 && returnedCount === 0) {
          riskScore = 'LOW'
          riskFactors.push(`Trusted customer with ${deliveredCount} verified delivered order(s).`)
        }
      }

      if (district && !['dhaka', 'dhaka city'].includes(district.toLowerCase().trim())) {
        if (riskScore === 'MEDIUM') riskScore = 'HIGH'
        riskFactors.push('Outside Dhaka delivery — requires courier shipping fee commitment.')
      }

      return reply({
        phone: cleanPhone,
        district: district ?? 'Inside/Outside Dhaka unspecified',
        codRiskScore: riskScore,
        metrics: {
          totalPastOrders: totalOrders,
          delivered: deliveredCount,
          cancelled: cancelledCount,
          returned: returnedCount,
        },
        riskFactors,
        recommendation:
          riskScore === 'CRITICAL' || riskScore === 'HIGH'
            ? 'Request advance delivery charge payment (৳60 / ৳120) before courier dispatch.'
            : 'Safe for standard Cash on Delivery dispatch.',
      })
    },
  )

  // 2. Unit Economics & Profitability Calculator
  server.registerTool(
    'calculate_unit_economics',
    {
      title: 'Calculate Order Unit Economics & Net Profit',
      description:
        'Calculates gross revenue, COGS (cost of goods), courier fee, delivery subsidy, gateway charges, and net profit margin for an order. Answers "what is profit on order SPL-1004?".',
      inputSchema: {
        orderId: z.string().optional().describe('Order ID or Invoice Number e.g. SPL-1004'),
      },
    },
    async ({ orderId }) => {
      const store = await storeId()

      if (!orderId) {
        return replyError('Please provide an orderId or invoice number.')
      }

      const order = await prisma().order.findFirst({
        where: {
          storeId: store,
          OR: [
            { id: orderId },
            { invoiceNumber: { equals: orderId, mode: 'insensitive' } },
          ],
        },
        include: {
          items: {
            include: {
              variant: true,
            },
          },
        },
      })

      if (!order) {
        return replyError(`Order "${orderId}" not found.`)
      }

      const grossRevenue = Number(order.total)
      const collectedDeliveryFee = Number(order.deliveryCharge)
      const discountGiven = Number(order.discount)

      let totalCogs = 0
      for (const item of order.items) {
        const itemPrice = Number(item.price)
        // Assume estimated COGS ~ 35% of retail price if costPrice is unpopulated
        const estimatedItemCost = itemPrice * 0.35
        totalCogs += estimatedItemCost * item.quantity
      }

      // Actual courier charge estimate
      const actualCourierFee = order.isInsideDhaka ? 60 : 120
      const deliverySubsidy = Math.max(0, actualCourierFee - collectedDeliveryFee)

      // Gateway fee estimate
      let gatewayFee = 0
      if (order.paymentMethod === 'CASH_ON_DELIVERY') {
        gatewayFee = Math.round(grossRevenue * 0.01) // 1% COD fee
      } else if (order.paymentMethod === 'BKASH' || order.paymentMethod === 'NAGAD') {
        gatewayFee = Math.round(grossRevenue * 0.015) // 1.5% MFS fee
      } else if (order.paymentMethod === 'SSLCOMMERZ' || order.paymentMethod === 'CARD') {
        gatewayFee = Math.round(grossRevenue * 0.025) // 2.5% Card fee
      }

      const netProfit = grossRevenue - totalCogs - actualCourierFee - gatewayFee
      const marginPercent = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : '0'

      return reply({
        invoice: order.invoiceNumber ?? order.id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        financials: {
          grossRevenue: money(grossRevenue),
          discountGiven: money(discountGiven),
          estimatedCogs: money(totalCogs),
          actualCourierFee: money(actualCourierFee),
          collectedDeliveryFee: money(collectedDeliveryFee),
          deliverySubsidy: money(deliverySubsidy),
          gatewayFee: money(gatewayFee),
          netProfit: money(netProfit),
          profitMargin: `${marginPercent}%`,
        },
      })
    },
  )

  // 3. Abandoned Cart Recovery Copy Generator
  server.registerTool(
    'generate_cart_recovery_message',
    {
      title: 'Generate Abandoned Cart Recovery Message',
      description:
        'Generates personalized Banglish/Bangla SMS and WhatsApp recovery message for an abandoned cart. Answers "draft recovery SMS for cart".',
      inputSchema: {
        cartId: z.string().describe('Cart session ID'),
      },
    },
    async ({ cartId }) => {
      const store = await storeId()

      const cart = await prisma().cartSession.findFirst({
        where: { id: cartId, storeId: store },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      })

      if (!cart) {
        return replyError(`Cart session "${cartId}" not found.`)
      }

      const items = cart.items || []
      const itemCount = items.length
      const firstItem = items[0]?.product?.name ?? 'your selected items'

      const smsText = `Hi! SPLARO-তে আপনার ${firstItem} সহ ${itemCount}টি আইটেম কার্টে অপেক্ষা করছে। এখনই চেকআউট সম্পন্ন করতে ভিজিট করুন: https://splaro.co/cart`

      const whatsappText = `আসসালামু আলাইকুম! SPLARO থেকে সানজিদা বলছি। 🌸\n\nআপনি আপনার ব্যাগে *${firstItem}* রেখে গেছেন। স্টক সীমিত রয়েছে! অর্ডার কনফার্ম করতে এখানে ক্লিক করুন: https://splaro.co/cart\n\nযেকোনো সাহায্যে আমাদের মেসেজ দিন। ধন্যবাদ!`

      return reply({
        cartId,
        itemCount,
        firstItem,
        messages: {
          sms: smsText,
          whatsapp: whatsappText,
        },
      })
    },
  )
}

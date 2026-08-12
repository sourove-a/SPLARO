import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export function registerPrompts(server: McpServer): void {
  // 1. Daily Executive Business Digest
  server.registerPrompt(
    'daily_business_digest',
    {
      description: 'Generates a structured executive digest template of sales, orders, and action items for today.',
      argsSchema: {
        focus: z.string().optional().describe('Special focus area e.g. inventory, revenue, courier'),
      },
    },
    async ({ focus }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `Generate a structured executive business digest for SPLARO today.\n` +
                `First call the tool 'sales_summary' with period='today', and call 'store_overview'.\n` +
                `Focus area: ${focus ?? 'General Overview'}.\n` +
                `Format output into bullet points: Revenue, Orders Count, Pending Actions, and Best Selling Items.`,
            },
          },
        ],
      }
    },
  )

  // 2. Draft Customer Support Response
  server.registerPrompt(
    'draft_customer_support_response',
    {
      description: 'Drafts a brand-aligned Banglish reply for customer order queries.',
      argsSchema: {
        orderId: z.string().describe('Order ID or Invoice Number e.g. SPL-1004'),
        issue: z.string().describe('Customer query issue e.g. delivery delay, size exchange'),
      },
    },
    async ({ orderId, issue }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `First call tool 'get_order' with orderId='${orderId}'.\n` +
                `Then draft a polite, brand-aligned Banglish customer service response addressing this issue: '${issue}'.\n` +
                `Include order details, delivery estimate, and sign off as 'SPLARO Customer Care'.`,
            },
          },
        ],
      }
    },
  )
}

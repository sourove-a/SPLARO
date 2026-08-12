import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerPrompts } from './prompts/index.ts'
import { registerResources } from './resources/index.ts'
import { registerActionTools } from './tools/actions.ts'
import { registerAnalyticsTools } from './tools/analytics.ts'
import { registerCatalogTools } from './tools/catalog.ts'
import { registerIntelligenceTools } from './tools/intelligence.ts'
import { registerOperationsTools } from './tools/operations.ts'
import { registerOrderTools } from './tools/orders.ts'

const INSTRUCTIONS =
  'Enterprise Commerce AI Interface for SPLARO (catalog, orders, customers, intelligence, actions). ' +
  'All amounts are BDT and day boundaries follow Asia/Dhaka. ' +
  'Use store_overview for broad queries, assess_cod_risk for buyer risk assessment, ' +
  'and calculate_unit_economics for order profit margins. ' +
  'Mutations require confirm:true and go through Nest OrderStatusService / product APIs.'

/** One McpServer per transport session — SDK Protocol forbids reconnecting the same instance. */
export function createSplaroMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'splaro', version: '2.0.0' },
    { instructions: INSTRUCTIONS },
  )

  registerCatalogTools(server)
  registerOrderTools(server)
  registerOperationsTools(server)
  registerAnalyticsTools(server)
  registerIntelligenceTools(server)
  registerActionTools(server)
  registerResources(server)
  registerPrompts(server)

  return server
}

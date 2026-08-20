export interface TelegramDeliveryDiagnostics {
  ok: boolean
  reason: string
  hint: string
}

export type TelegramOperationalState = 'online' | 'degraded' | 'offline' | 'unconfigured'

export interface TelegramHealthSnapshot {
  botTokenConfigured: boolean
  botTokenSource: 'env' | 'database' | 'none'
  botRunning: boolean
  botUsername: string | null
  transportMode: 'polling' | 'webhook' | 'send-only' | 'disabled'
  webhookUrl: string | null
  webhookRegistered: boolean
  linkedAdminCount: number
  linkedAdmins: { id: string; telegramIdMasked: string; username: string | null; role: string }[]
  configChatIdMasked: string | null
  hasLinkedAdminChat: boolean
  lastDeliveryStatus: 'success' | 'failed' | 'none'
  lastDeliveryError: string | null
  lastDeliveryAt: string | null
  networkVerified: boolean
  /** Single chip/KPI status — do not mix with API ping. */
  operationalState: TelegramOperationalState
  operationalLabel: string
  operationalSync: string
  transportValue: string
  transportDetail: string
}

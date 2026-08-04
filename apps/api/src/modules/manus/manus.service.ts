import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { EncryptionService } from '../integrations/encryption.service'

const MANUS_BASE_URL = 'https://api.manus.ai/v2'
const REQUEST_TIMEOUT_MS = 30_000

export type ManusAgentProfile = 'manus-1.6' | 'manus-1.6-lite' | 'manus-1.6-max'
export type ManusTaskStatus = 'running' | 'stopped' | 'waiting' | 'error'

export const MANUS_AGENT_PROFILES: ManusAgentProfile[] = ['manus-1.6', 'manus-1.6-lite', 'manus-1.6-max']

export interface ManusTask {
  id: string
  status: ManusTaskStatus
  title: string
  taskUrl: string
  creditUsage: number
  agentProfile: string | null
  createdAt: number
  updatedAt: number
}

export interface ManusTaskEvent {
  id: string
  type: string
  timestamp: number
  content: string
  attachments: { filename: string; url: string; contentType: string }[]
}

/** The `{ ok: false, error: { code, message } }` envelope Manus returns on failure. */
interface ManusEnvelope {
  ok?: boolean
  request_id?: string
  error?: { code?: string; message?: string }
}

function looksLikePlaceholder(key: string): boolean {
  return /paste|your-|example|changeme|todo|replace/i.test(key) || key.length < 20
}

@Injectable()
export class ManusService {
  private readonly logger = new Logger(ManusService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: EncryptionService,
  ) {}

  /**
   * Manus is an autonomous agent API, not a chat model — it cannot be used as an
   * agent-brain provider, because it runs its own tools rather than SPLARO's.
   * Key is saved from AI Command Brain (AgentConfig.manusKey), with env fallback.
   */
  private decryptStored(stored: string | null | undefined): string | null {
    if (!stored?.trim()) return null
    try {
      return this.crypto.decrypt(stored)
    } catch {
      // Never treat enc:… ciphertext as a usable key — Manus would return invalid api key.
      return null
    }
  }

  private envFallbackKey(): string | null {
    const key = this.config.get<string>('MANUS_API_KEY')?.trim()
    if (!key || looksLikePlaceholder(key)) return null
    return key
  }

  async resolveApiKey(storeIdRaw?: string): Promise<string | null> {
    try {
      const storeId = await resolveStoreId(this.prisma, storeIdRaw ?? 'splaro')
      const row = await this.prisma.agentConfig.findUnique({
        where: { storeId },
        select: { manusKey: true },
      })
      const fromDb = this.decryptStored(row?.manusKey)?.trim()
      if (fromDb && !looksLikePlaceholder(fromDb)) return fromDb
    } catch (err) {
      this.logger.warn(`Manus DB key resolve failed: ${err instanceof Error ? err.message : 'error'}`)
    }
    return this.envFallbackKey()
  }

  async isConfigured(storeIdRaw?: string): Promise<boolean> {
    return Boolean(await this.resolveApiKey(storeIdRaw))
  }

  private async requireApiKey(storeIdRaw?: string): Promise<string> {
    const key = await this.resolveApiKey(storeIdRaw)
    if (!key) {
      throw new BadRequestException(
        'Manus API key missing. Open AI Command Brain → API keys → Manus, paste your key, Save. Or set MANUS_API_KEY in API .env and restart.',
      )
    }
    return key
  }

  private async call<T>(
    endpoint: string,
    init: { method: 'GET' | 'POST'; query?: Record<string, string | number | undefined>; body?: unknown },
  ): Promise<T> {
    const apiKey = await this.requireApiKey()
    const url = new URL(`${MANUS_BASE_URL}/${endpoint}`)
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }

    let res: Response
    try {
      res = await fetch(url, {
        method: init.method,
        headers: {
          'x-manus-api-key': apiKey,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'network error'
      throw new ServiceUnavailableException(`${init.method} ${MANUS_BASE_URL}/${endpoint} → ${reason}`)
    }

    const payload = (await res.json().catch(() => ({}))) as ManusEnvelope & Record<string, unknown>

    // Surface the real Manus error verbatim — never a paraphrase.
    if (!res.ok || payload.ok === false) {
      const code = payload.error?.code ?? String(res.status)
      const message = payload.error?.message ?? res.statusText
      this.logger.warn(`Manus ${endpoint} failed: ${code} ${message}`)
      throw new BadRequestException(`${MANUS_BASE_URL}/${endpoint} → ${code}: ${message}`)
    }

    return payload as T
  }

  async createTask(input: {
    prompt: string
    agentProfile?: ManusAgentProfile
    locale?: string
    title?: string
  }): Promise<{ taskId: string; title: string; taskUrl: string }> {
    const prompt = input.prompt?.trim()
    if (!prompt) throw new BadRequestException('Prompt is required')

    const res = await this.call<{ task_id: string; task_title: string; task_url: string }>('task.create', {
      method: 'POST',
      body: {
        // Manus v2 requires message.content (string or text parts) — not message.prompt.
        message: { content: prompt },
        ...(input.agentProfile ? { agent_profile: input.agentProfile } : {}),
        ...(input.locale ? { locale: input.locale } : {}),
        ...(input.title?.trim() ? { title: input.title.trim() } : {}),
      },
    })

    return { taskId: res.task_id, title: res.task_title, taskUrl: res.task_url }
  }

  async listTasks(limit = 20, cursor?: string): Promise<{ tasks: ManusTask[]; nextCursor: string | null }> {
    const res = await this.call<{
      data?: Array<Record<string, unknown>>
      has_more?: boolean
      next_cursor?: string
    }>('task.list', {
      method: 'GET',
      query: { limit: Math.min(Math.max(limit, 1), 100), ...(cursor ? { cursor } : {}), order: 'desc' },
    })

    return {
      tasks: (res.data ?? []).map((row) => ({
        id: String(row['id'] ?? ''),
        status: (row['status'] as ManusTaskStatus) ?? 'error',
        title: String(row['title'] ?? 'Untitled task'),
        taskUrl: String(row['task_url'] ?? ''),
        creditUsage: Number(row['credit_usage'] ?? 0),
        agentProfile: row['agent_profile'] ? String(row['agent_profile']) : null,
        createdAt: Number(row['created_at'] ?? 0),
        updatedAt: Number(row['updated_at'] ?? 0),
      })),
      nextCursor: res.has_more ? (res.next_cursor ?? null) : null,
    }
  }

  /** Manus has no streaming — progress is polled from the message log. */
  async listMessages(taskId: string, limit = 50): Promise<ManusTaskEvent[]> {
    if (!taskId?.trim()) throw new BadRequestException('taskId is required')

    const res = await this.call<{ messages?: Array<Record<string, unknown>> }>('task.listMessages', {
      method: 'GET',
      query: { task_id: taskId, limit: Math.min(Math.max(limit, 1), 200), order: 'asc' },
    })

    return (res.messages ?? []).map((event) => {
      const type = String(event['type'] ?? 'unknown')
      const payload = (event[type] ?? {}) as Record<string, unknown>
      const attachments = Array.isArray(payload['attachments']) ? payload['attachments'] : []

      return {
        id: String(event['id'] ?? ''),
        type,
        timestamp: Number(event['timestamp'] ?? 0),
        content: this.describeEvent(type, payload),
        attachments: attachments.map((raw) => {
          const item = raw as Record<string, unknown>
          return {
            filename: String(item['filename'] ?? 'file'),
            url: String(item['url'] ?? ''),
            contentType: String(item['content_type'] ?? ''),
          }
        }),
      }
    })
  }

  /** Different event types carry their text under different keys. */
  private describeEvent(type: string, payload: Record<string, unknown>): string {
    const content = payload['content']
    if (typeof content === 'string' && content.trim()) return content
    if (type === 'status_update') {
      const brief = payload['brief']
      const detail = payload['status_detail']
      if (typeof brief === 'string' && brief.trim()) return brief
      if (typeof detail === 'string' && detail.trim()) return detail
    }
    if (type === 'structured_output_result') {
      try {
        return JSON.stringify(payload['value'] ?? payload)
      } catch {
        /* fall through */
      }
    }
    return ''
  }

  async stopTask(taskId: string): Promise<{ ok: true }> {
    if (!taskId?.trim()) throw new BadRequestException('taskId is required')
    await this.call('task.stop', { method: 'POST', body: { task_id: taskId } })
    return { ok: true }
  }
}

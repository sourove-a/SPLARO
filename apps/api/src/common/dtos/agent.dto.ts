import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

export const AGENT_MODEL_IDS = ['openai', 'gemini', 'claude', 'grok'] as const
export type AgentModelIdDto = (typeof AGENT_MODEL_IDS)[number]

export class AgentChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  sessionId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message!: string

  @IsOptional()
  @IsBoolean()
  stream?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  context?: string
}

export class AgentConfigDto {
  @IsOptional()
  @IsIn(AGENT_MODEL_IDS)
  activeModel?: AgentModelIdDto

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  systemPrompt?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  openaiKey?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  geminiKey?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  claudeKey?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  grokKey?: string

  @IsOptional()
  @IsIn(['api_key', 'antigravity_proxy'])
  claudeAuthMode?: 'api_key' | 'antigravity_proxy'

  @IsOptional()
  @IsString()
  @MaxLength(500)
  claudeBaseUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  claudeAuthToken?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  telegramChatId?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  telegramBotToken?: string
}

export class AgentSwitchModelDto {
  @IsIn(AGENT_MODEL_IDS)
  model!: AgentModelIdDto
}

export class AgentPromptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  prompt!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}

export class AgentTelegramTestDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string
}

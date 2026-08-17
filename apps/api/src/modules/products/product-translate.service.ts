import { BadRequestException, Injectable, Logger } from '@nestjs/common'

import { ModelRouter } from '../agent/providers/model-router'

/**
 * English product copy → real Bangla.
 *
 * The admin used to build the "Bangla" text from a fixed template that only
 * swapped in Bangla connectives — output like
 * `refined Men's Shoes যেখানে premium tailoring meets everyday luxury।` — which
 * is Banglish, not Bangla, and reads as broken to an actual Bangla customer.
 *
 * This routes through the store's existing model provider rather than adding a
 * dedicated translation vendor. Two reasons: the keys, fallback and cost
 * accounting already exist, and a general model handles the thing a translation
 * API gets wrong here — leaving `SPLARO` and `Air Jordan 4 Retro` in Latin
 * script while translating the sentence around them.
 */

export interface ProductTranslateInput {
  storeId: string
  name?: string
  description?: string
}

export interface ProductTranslateResult {
  nameBn?: string
  descriptionBn?: string
  /** Which provider answered, so the admin can show it and debug key issues. */
  model: string
}

/** Guards the prompt against a pasted essay running up a bill. */
const MAX_INPUT_CHARS = 4000

const SYSTEM_PROMPT = `You translate e-commerce product copy from English into natural, fluent Bangla for a Bangladeshi clothing brand called SPLARO.

Rules:
- Write real Bangla, not transliterated English and not code-mixed "Banglish". A Bangla-speaking customer must be able to read it as ordinary Bangla.
- Keep these in Latin script exactly as given: the brand name SPLARO, product/model names (e.g. "Air Jordan 4 Retro"), size codes (S, M, L, XL), and measurement units.
- Widely used loanwords that Bangladeshi shoppers genuinely say in English (e.g. অর্ডার, ডেলিভারি) should be written in Bangla script, not left in Latin.
- Preserve meaning, tone and paragraph breaks. Do not add claims, prices, or details that are not in the source.
- Use the Bangla danda (।) to end sentences.

Return ONLY a JSON object, no prose and no code fences, with these optional string keys: "nameBn", "descriptionBn". Include a key only if the matching input was provided.`

@Injectable()
export class ProductTranslateService {
  private readonly logger = new Logger(ProductTranslateService.name)

  constructor(private readonly modelRouter: ModelRouter) {}

  async translate(input: ProductTranslateInput): Promise<ProductTranslateResult> {
    const name = input.name?.trim() ?? ''
    const description = input.description?.trim() ?? ''
    if (!name && !description) {
      throw new BadRequestException('Nothing to translate — send a name or a description.')
    }
    if (name.length + description.length > MAX_INPUT_CHARS) {
      throw new BadRequestException(`Text is too long to translate (limit ${MAX_INPUT_CHARS} characters).`)
    }

    const { provider, apiKey, model, providerOptions } = await this.modelRouter.getProvider(input.storeId)

    // Manus has no synchronous chat endpoint — it runs polled async tasks — and
    // its own preamble instructs the model to answer in "Bangla/Banglish/English
    // matching the user", which is precisely the output this service exists to
    // stop producing. Refuse rather than quietly hand back more Banglish.
    if (provider.id === 'manus') {
      throw new BadRequestException(
        'Manus cannot be used for translation. Add a Claude, OpenAI or Gemini key in AI Command Brain and pick it as the active model.',
      )
    }

    const payload: Record<string, string> = {}
    if (name) payload['name'] = name
    if (description) payload['description'] = description

    const result = await provider.chat(
      [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        { role: 'user' as const, content: JSON.stringify(payload) },
      ],
      [],
      apiKey,
      providerOptions,
    )

    const content = result.content?.trim()
    if (!content) {
      throw new BadRequestException(`Translation model (${model}) returned nothing.`)
    }

    // Models still wrap JSON in prose or fences often enough that the object has
    // to be found rather than assumed to be the whole reply.
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new BadRequestException(`Translation model (${model}) did not return JSON.`)
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      throw new BadRequestException(`Translation model (${model}) returned malformed JSON.`)
    }

    const nameBn = typeof parsed['nameBn'] === 'string' ? parsed['nameBn'].trim() : ''
    const descriptionBn = typeof parsed['descriptionBn'] === 'string' ? parsed['descriptionBn'].trim() : ''

    if ((name && !nameBn) || (description && !descriptionBn)) {
      this.logger.warn(`[translate] ${model} skipped a requested field`)
    }
    if (!nameBn && !descriptionBn) {
      throw new BadRequestException(`Translation model (${model}) returned no Bangla text.`)
    }

    return {
      ...(nameBn ? { nameBn } : {}),
      ...(descriptionBn ? { descriptionBn } : {}),
      model: String(model),
    }
  }
}

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { resolveCustomerFacingSiteUrl } from '@splaro/config'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { ModelRouter } from '../agent/providers/model-router'
import type { AIJobType } from '@prisma/client'

export interface AIProductInput {
  productName: string
  /**
   * What the operator actually wrote about this product.
   *
   * Without it the model only ever saw a name and a few attributes, so it had
   * nothing to work from and invented the rest — which is why the output read
   * as generic filler no matter what had been typed into the form. When this is
   * present it is the source of truth and everything else is derived from it.
   */
  description?: string
  /** Existing Bangla copy, if the operator already wrote some. */
  descriptionBn?: string
  nameBn?: string
  fabric?: string
  color?: string
  category?: string
  price?: number
  occasion?: string
  size?: string
  stock?: number
  imageUrl?: string
}

@Injectable()
export class AIProductAgentService {
  private readonly logger = new Logger(AIProductAgentService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly modelRouter: ModelRouter,
  ) {}

  private async resolveStore(storeIdOrSlug: string) {
    return resolveStoreId(this.prisma, storeIdOrSlug)
  }

  /** Match jobs stored with resolved id or legacy slug (e.g. "splaro"). */
  private storeJobFilter(storeIdOrSlug: string, resolvedId: string) {
    const raw = storeIdOrSlug?.trim()
    const ids = raw && raw !== resolvedId ? [resolvedId, raw] : [resolvedId]
    return { storeId: { in: ids } }
  }

  async createJob(storeIdOrSlug: string, input: AIProductInput, createdBy?: string) {
    const storeId = await this.resolveStore(storeIdOrSlug)

    const job = await this.prisma.aIJob.create({
      data: {
        storeId,
        type: 'PRODUCT_AUTOMATION' as AIJobType,
        status: 'PROCESSING',
        createdBy,
        inputData: input as object,
        startedAt: new Date(),
      },
    })

    try {
      const { providerOptions } = await this.modelRouter.getProvider(storeId)
      const output = await this.generateContent(input, storeId)
      const completed = await this.prisma.aIJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          outputData: output as object,
          completedAt: new Date(),
          model: providerOptions?.model ?? this.config.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
        },
      })

      await this.prisma.aIContentApproval.create({
        data: {
          storeId,
          jobId: job.id,
          status: 'PENDING',
        },
      })

      return completed
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'AI generation failed'
      await this.prisma.aIJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errorMsg, completedAt: new Date() },
      })
      throw new BadRequestException(errorMsg)
    }
  }

  async listJobs(storeIdOrSlug: string, page = 1, limit = 20) {
    const storeId = await this.resolveStore(storeIdOrSlug)
    const skip = (page - 1) * limit
    const storeFilter = this.storeJobFilter(storeIdOrSlug, storeId)
    const [items, total] = await Promise.all([
      this.prisma.aIJob.findMany({
        where: { ...storeFilter, type: 'PRODUCT_AUTOMATION' },
        include: { approval: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.aIJob.count({ where: { ...storeFilter, type: 'PRODUCT_AUTOMATION' } }),
    ])
    return { items, total, page, totalPages: Math.ceil(total / limit) }
  }

  async approveJob(jobId: string, storeIdOrSlug: string, reviewedBy?: string, notes?: string) {
    const storeId = await this.resolveStore(storeIdOrSlug)
    const job = await this.prisma.aIJob.findFirst({
      where: { id: jobId, ...this.storeJobFilter(storeIdOrSlug, storeId) },
      include: { approval: true },
    })
    if (!job) throw new NotFoundException('AI job not found')

    return this.prisma.aIContentApproval.upsert({
      where: { jobId },
      create: {
        storeId,
        jobId,
        status: 'APPROVED',
        reviewedBy,
        reviewedAt: new Date(),
        notes,
      },
      update: {
        status: 'APPROVED',
        reviewedBy,
        reviewedAt: new Date(),
        notes,
      },
    })
  }

  async rejectJob(jobId: string, storeIdOrSlug: string, reviewedBy?: string, notes?: string) {
    const storeId = await this.resolveStore(storeIdOrSlug)
    const job = await this.prisma.aIJob.findFirst({
      where: { id: jobId, ...this.storeJobFilter(storeIdOrSlug, storeId) },
    })
    if (!job) throw new NotFoundException('AI job not found')

    return this.prisma.aIContentApproval.upsert({
      where: { jobId },
      create: {
        storeId,
        jobId,
        status: 'REJECTED',
        reviewedBy,
        reviewedAt: new Date(),
        notes,
      },
      update: {
        status: 'REJECTED',
        reviewedBy,
        reviewedAt: new Date(),
        notes,
      },
    })
  }

  private normalizeOutput(raw: Record<string, unknown>) {
    const description =
      (typeof raw['description'] === 'string' && raw['description']) ||
      (typeof raw['longDescription'] === 'string' && raw['longDescription']) ||
      (typeof raw['shortDescription'] === 'string' && raw['shortDescription']) ||
      (typeof raw['descriptionEn'] === 'string' && raw['descriptionEn']) ||
      ''
    const metaTitle =
      (typeof raw['metaTitle'] === 'string' && raw['metaTitle']) ||
      (typeof raw['seoTitle'] === 'string' && raw['seoTitle']) ||
      (typeof raw['title'] === 'string' && raw['title']) ||
      ''
    const metaDescription =
      (typeof raw['metaDescription'] === 'string' && raw['metaDescription']) ||
      (typeof raw['seoMetaDescription'] === 'string' && raw['seoMetaDescription']) ||
      ''

    return {
      ...raw,
      description,
      metaTitle,
      metaDescription,
      longDescription: raw['longDescription'] ?? description,
      seoTitle: raw['seoTitle'] ?? metaTitle,
      seoMetaDescription: raw['seoMetaDescription'] ?? metaDescription,
    }
  }

  private async generateContent(input: AIProductInput, storeId: string) {
    /*
     * Auto routing picks OpenRouter first, so one dead/rejected key there used
     * to fail the whole fill even when a working OpenAI/Gemini key was saved.
     * Walk every configured provider instead of trusting the first one.
     */
    const chain = await this.modelRouter.getFailoverChain(storeId, 'complex')
    const skuBase = input.productName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6)
    const sku = `SPL-${skuBase}-${Date.now().toString().slice(-4)}`
    const rmCode = `RM-${skuBase}-${input.color?.slice(0, 3).toUpperCase() ?? 'STD'}`
    const siteUrl = resolveCustomerFacingSiteUrl(this.config.get<string>('WEB_URL'))
    const slug = input.productName.toLowerCase().replace(/\s+/g, '-').slice(0, 60)

    const base = {
      title: `${input.productName} — ${input.fabric ?? 'Premium'} ${input.color ?? ''}`.trim(),
      shortDescription: `Luxury ${input.category ?? 'fashion'} piece by SPLARO. ${input.fabric ?? 'Premium fabric'}, ${input.color ?? 'elegant'} tone.`,
      longDescription: `Discover ${input.productName} from SPLARO — crafted for ${input.occasion ?? 'every occasion'}. Fabric: ${input.fabric ?? 'premium'}. Available sizes: ${input.size ?? 'S–XL'}.`,
      seoTitle: `${input.productName} | SPLARO Bangladesh`,
      seoMetaDescription: `Shop ${input.productName} at SPLARO. ${input.fabric ?? 'Premium'} ${input.category ?? 'fashion'} with nationwide delivery.`,
      tags: [input.category, input.fabric, input.color, input.occasion, 'SPLARO', 'luxury'].filter(Boolean),
      keywords: [input.productName, input.category, input.fabric, 'women fashion bd', 'splaro'].filter(Boolean) as string[],
      descriptionBn: `${input.productName} — SPLARO থেকে প্রিমিয়াম ${input.category ?? 'ফ্যাশন'}।`,
      descriptionEn: `${input.productName} — premium ${input.category ?? 'fashion'} from SPLARO.`,
      careInstructions: 'Dry clean only. Store in cool dry place. Iron on low heat.',
      sizeGuideSuggestion: 'True to size. Model wears size M.',
      instagramCaption: `✨ ${input.productName}\n${input.fabric ?? 'Premium'} · ${input.color ?? ''}\nShop: ${siteUrl}/products/${slug}`,
      facebookCaption: `New arrival: ${input.productName}. Order now at SPLARO.`,
      whatsappMessage: `🛍 ${input.productName}\nPrice: ৳${input.price ?? 0}\nOrder: ${siteUrl}/products/${slug}`,
      googleMerchantTitle: `${input.productName} — SPLARO Women's Fashion`,
      altText: `${input.productName} ${input.color ?? ''} ${input.category ?? 'product'} photo`,
      skuSuggestion: sku,
      rmCodeSuggestion: rmCode,
      qrCodeData: `${siteUrl}/products/${slug}?sku=${sku}`,
      barcodeData: sku.replace(/-/g, ''),
      shareLink: `${siteUrl}/products/${slug}`,
    }

    const hasSourceCopy = Boolean(input.description?.trim())

    /*
     * Two different jobs share this call.
     *
     * With a description, the operator has already said what the product is and
     * the model's job is to expand and translate that — not to have opinions
     * about the product. Without one it has to write from the attributes, which
     * is the old behaviour and the reason output felt invented.
     */
    const grounding = hasSourceCopy
      ? [
          'The operator has written the product description themselves. It is the source of truth.',
          'Rewrite and polish it into `description`/`descriptionEn`, keeping every fact, material, measurement and claim it contains. Do not add features, fabrics, occasions, certifications or benefits it does not state.',
          'Derive metaTitle, seoTitle, metaDescription, seoMetaDescription, tags and keywords from that same text, not from imagination.',
          '`descriptionBn` must be a faithful Bangla translation of it — natural Bangla, not transliterated English and not code-mixed "Banglish". Keep the brand name SPLARO and product/model names (e.g. "Air Jordan 4 Retro") in Latin script. End sentences with the Bangla danda (।).',
          'If a detail is genuinely unknown, leave that field out rather than guessing.',
        ].join(' ')
      : [
          'No description was supplied, so write one from the given attributes only.',
          'Do not invent materials, measurements or certifications that were not provided.',
          '`descriptionBn` must be natural Bangla, not "Banglish", keeping SPLARO and model names in Latin script.',
        ].join(' ')

    const messages = [
      {
        role: 'system' as const,
        content: `You are SPLARO's product copywriter for a Bangladeshi fashion store. ${grounding} Return a single JSON object — no prose, no code fences — with these keys where you have grounds for them: description, longDescription, metaTitle, seoTitle, metaDescription, seoMetaDescription, tags, keywords, descriptionBn, descriptionEn, nameBn, careInstructions, sizeGuideSuggestion, instagramCaption, facebookCaption, whatsappMessage. Both a Bangla and an English description are required. \`nameBn\` is the product title in Bangla, with the brand and model name left in Latin script. metaTitle must be at most 60 characters and metaDescription at most 155, since they render in Google results.`,
      },
      {
        role: 'user' as const,
        content: hasSourceCopy
          ? `Product: ${JSON.stringify({ ...input, description: undefined })}\n\nOperator's own description (source of truth):\n"""\n${input.description?.trim()}\n"""${input.descriptionBn?.trim() ? `\n\nExisting Bangla the operator wrote — match its wording and tone:\n"""\n${input.descriptionBn.trim()}\n"""` : ''}`
          : `Generate product content for: ${JSON.stringify(input)}. Base template for tone and shape only: ${JSON.stringify(base)}`,
      },
    ]

    let content = ''
    let model: string = chain[0]?.model ?? 'auto'
    const failures: string[] = []
    for (const candidate of chain) {
      try {
        const result = await candidate.provider.chat(
          messages,
          [],
          candidate.apiKey,
          candidate.providerOptions,
        )
        const text = result.content?.trim()
        if (!text) {
          failures.push(`${candidate.model}: empty content`)
          continue
        }
        content = text
        model = candidate.model
        break
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'request failed'
        failures.push(`${candidate.model}: ${reason}`)
        this.logger.warn(`AI product fill failed on ${candidate.model} — ${reason}`)
      }
    }

    if (!content) {
      throw new BadRequestException(
        failures.length
          ? `AI fill failed on every configured model — ${failures.join(' | ')}`
          : 'No AI API key configured. Add one in AI Command Brain.',
      )
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new BadRequestException(`AI model (${model}) returned non-JSON content`)
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      /*
       * `base` is two different things wearing one name: mechanical values
       * derived from real data (SKU, barcode, share link) and placeholder prose
       * invented from the product name. Merging all of it under the model's
       * reply meant any field the model left out was backfilled with invented
       * copy — which is what made the result look random even when the operator
       * had written a perfectly good description.
       *
       * So the prose half is only used as a fallback when there was nothing to
       * work from. When the operator wrote a description, an omitted field stays
       * omitted rather than being filled with something they did not say.
       */
      const mechanical = {
        skuSuggestion: base.skuSuggestion,
        rmCodeSuggestion: base.rmCodeSuggestion,
        qrCodeData: base.qrCodeData,
        barcodeData: base.barcodeData,
        shareLink: base.shareLink,
      }
      const fallback = hasSourceCopy ? mechanical : base
      return this.normalizeOutput({ ...fallback, ...parsed })
    } catch {
      throw new BadRequestException(`AI model (${model}) returned invalid JSON`)
    }
  }
}

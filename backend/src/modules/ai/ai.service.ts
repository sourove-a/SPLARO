import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async processStylistQuery(userId: string, message: string, sessionId?: string) {
    // 1. Get or create session
    let session;
    if (sessionId) {
      session = await this.prisma.aiSession.findUnique({ where: { id: sessionId } });
    }
    if (!session) {
      session = await this.prisma.aiSession.create({ data: { userId } });
    }

    // 2. Save user message
    await this.prisma.aiMessage.create({
      data: { sessionId: session.id, role: 'user', content: message },
    });

    // 3. Call LLM provider (placeholder - connect to OpenAI/Gemini in production)
    const aiReply = `Based on your query "${message}", I recommend checking our latest Performance collection. Would you like me to filter by size or color?`;

    // 4. Save AI response
    await this.prisma.aiMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: aiReply },
    });

    return { sessionId: session.id, reply: aiReply };
  }

  async predictBestFit(feetSpecs: any) {
    // AI-powered size recommendation logic
    const { footLength, footWidth, preferredFit } = feetSpecs;
    let recommendedSize = '42';

    if (footLength && footLength > 27) recommendedSize = '44';
    else if (footLength && footLength > 25) recommendedSize = '42';
    else recommendedSize = '40';

    return {
      recommendedSize,
      confidence: 0.92,
      note: preferredFit === 'snug' ? 'Consider half size down' : 'True to size',
    };
  }

  async getPersonalizedCatalog(userId: string) {
    // Fetch user history and recommend products
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { orders: { include: { items: true } } },
    });

    return this.prisma.product.findMany({
      where: { status: 'PUBLISHED', isFeatured: true },
      take: 8,
      include: { variants: true, images: true },
    });
  }
}

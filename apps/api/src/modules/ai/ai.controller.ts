import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { AiService } from './ai.service'

@Controller('ai')
export class AiExecutiveController {
  constructor(private readonly ai: AiService) {}

  @Post('executive/chat')
  chat(@Body() body: { question: string; storeId?: string }) {
    return this.ai.executiveChat(body.question)
  }
}

@Controller('ai-product-agent')
export class AiProductAgentController {
  constructor(private readonly ai: AiService) {}

  @Get('jobs')
  listJobs(
    @Query('storeId') storeId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ai.listProductAgentJobs(storeId, Number(page) || 1, Number(limit) || 20)
  }

  @Post('generate')
  generate(
    @Query('storeId') storeId: string,
    @Body() body: { input: Record<string, unknown>; createdBy?: string },
  ) {
    return this.ai.generateProductListing(storeId, body.input, body.createdBy)
  }

  @Patch('jobs/:id/approve')
  approve(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Body() body: { reviewedBy?: string; notes?: string },
  ) {
    return this.ai.approveProductAgentJob(id, storeId, body.reviewedBy, body.notes)
  }

  @Patch('jobs/:id/reject')
  reject(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Body() body: { reviewedBy?: string; notes?: string },
  ) {
    return this.ai.rejectProductAgentJob(id, storeId, body.reviewedBy, body.notes)
  }
}

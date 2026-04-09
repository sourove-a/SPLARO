import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser, Roles } from '../auth/decorators/auth.decorator';

@ApiTags('AI Intelligence')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('stylist/chat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chat with the SPLARO AI Stylist' })
  async chatWithStylist(
    @GetUser('id') userId: string,
    @Body('message') message: string,
    @Body('sessionId') sessionId?: string,
  ) {
    return this.aiService.processStylistQuery(userId, message, sessionId);
  }

  @Post('size-recommendation')
  @ApiOperation({ summary: 'Get AI-powered size recommendation' })
  async recommendSize(@Body() feetSpecs: any) {
    return this.aiService.predictBestFit(feetSpecs);
  }

  @Get('personalized-recommendations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getPersonalized(@GetUser('id') userId: string) {
    return this.aiService.getPersonalizedCatalog(userId);
  }
}

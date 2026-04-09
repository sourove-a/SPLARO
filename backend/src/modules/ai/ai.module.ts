import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { RecommendationService } from './recommendation.service';

@Module({
  controllers: [AiController],
  providers: [AiService, RecommendationService],
  exports: [AiService, RecommendationService],
})
export class AiModule {}

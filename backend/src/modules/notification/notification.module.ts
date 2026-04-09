import { Module } from '@nestjs/common';
import { NotificationProcessor } from './notification.processor';

@Module({
  providers: [NotificationProcessor],
  exports: [NotificationProcessor],
})
export class NotificationModule {}

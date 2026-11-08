import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionCron } from './subscription.cron';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [NotificationModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionCron],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}

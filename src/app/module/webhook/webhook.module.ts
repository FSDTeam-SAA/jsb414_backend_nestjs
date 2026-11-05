import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [NotificationModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}

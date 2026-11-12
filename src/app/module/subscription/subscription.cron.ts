// src/app/module/subscription/subscription.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import config from 'src/app/config';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class SubscriptionCron {
  private readonly logger = new Logger(SubscriptionCron.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Cron(config.everyDay || '0 0 * * *')
  async checkExpiredSubscriptions() {
    const now = new Date();
    this.logger.log(
      `⏰ [Cron Triggered] Running subscription expiration check at: ${now.toLocaleTimeString()}`,
    );

    try {
      const result = await this.subscriptionService.expireOverdueSubscriptions();
      this.logger.log(`✅ [SubscriptionCron] ${result.message}`);
    } catch (error) {
      this.logger.error(`❌ Subscription Cron Job Error:`, error);
    }
  }
}

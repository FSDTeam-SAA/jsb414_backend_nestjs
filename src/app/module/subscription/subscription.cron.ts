// src/app/module/subscription/subscription.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import config from 'src/app/config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SubscriptionCron {
  private readonly logger = new Logger(SubscriptionCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(config.everyDay!)
  async checkExpiredSubscriptions() {
    const now = new Date();
    this.logger.log(
      `⏰ [Cron Triggered] Running check at: ${now.toLocaleTimeString()}`,
    );

    try {
      // মেয়াদ শেষ হওয়া মেম্বারশিপ আপডেট করা
      const expired = await this.prisma.userSubscribe.updateMany({
        where: {
          endDate: { lt: now },
          status: 'ACTIVE',
        },
        data: {
          status: 'EXPIRED',
        },
      });

      if (expired.count > 0) {
        this.logger.warn(
          `✅ Found & updated ${expired.count} expired subscriptions to EXPIRED.`,
        );
      } else {
        this.logger.log(
          `👍 No expired subscriptions found. All active plans are valid.`,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Cron Job Error:`, error);
    }
  }
}

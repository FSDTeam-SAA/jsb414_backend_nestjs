import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgePriceModule } from './app/module/age-price/age-price.module';
import { AuthModule } from './app/module/auth/auth.module';
import { CardModule } from './app/module/card/card.module';
import { CategoriesModule } from './app/module/categories/categories.module';
import { HealthController } from './app/module/health/health.controller';
import { LeadModule } from './app/module/lead/lead.module';
import { MarketplaceModule } from './app/module/marketplace/marketplace.module';
import { SavedSearcModule } from './app/module/saved-searc/saved-searc.module';
import { SubscriptionModule } from './app/module/subscription/subscription.module';
import { UserModule } from './app/module/user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { OrderModule } from './app/module/order/order.module';
import { WalletModule } from './app/module/wallet/wallet.module';
import { WebhookModule } from './app/module/webhook/webhook.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    UserModule,
    PrismaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    SubscriptionModule,
    CategoriesModule,
    LeadModule,
    AgePriceModule,
    MarketplaceModule,
    CardModule,
    SavedSearcModule,
    OrderModule,
    WalletModule,
    WebhookModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}

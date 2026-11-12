import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AddAdminModule } from './app/module/add-admin/add-admin.module';
import { AgePriceModule } from './app/module/age-price/age-price.module';
import { AuthModule } from './app/module/auth/auth.module';
import { CardModule } from './app/module/card/card.module';
import { CategoriesModule } from './app/module/categories/categories.module';
import { ContactupModule } from './app/module/contactup/contactup.module';
import { HealthController } from './app/module/health/health.controller';
import { LeadModule } from './app/module/lead/lead.module';
import { MarketplaceModule } from './app/module/marketplace/marketplace.module';
import { NotificationModule } from './app/module/notification/notification.module';
import { OrderModule } from './app/module/order/order.module';
import { PromoCodeModule } from './app/module/promo-code/promo-code.module';
import { SavedSearcModule } from './app/module/saved-searc/saved-searc.module';
import { SubscriptionModule } from './app/module/subscription/subscription.module';
import { UserModule } from './app/module/user/user.module';
import { WalletModule } from './app/module/wallet/wallet.module';
import { WebhookModule } from './app/module/webhook/webhook.module';
import { PrismaModule } from './prisma/prisma.module';
import { DashboardModule } from './app/module/dashboard/dashboard.module';
import { ReportsModule } from './app/module/reports/reports.module';

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
    ContactupModule,
    AddAdminModule,
    PromoCodeModule,
    NotificationModule,
    DashboardModule,
    ReportsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}

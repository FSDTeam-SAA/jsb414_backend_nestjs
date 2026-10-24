import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './app/module/auth/auth.module';
import { CategoriesModule } from './app/module/categories/categories.module';
import { HealthController } from './app/module/health/health.controller';
import { SubscriptionModule } from './app/module/subscription/subscription.module';
import { UserModule } from './app/module/user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { LeadModule } from './app/module/lead/lead.module';
import { AgePriceModule } from './app/module/age-price/age-price.module';
import { MarketplaceModule } from './app/module/marketplace/marketplace.module';

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
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}

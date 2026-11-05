import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { PromoCodeModule } from '../promo-code/promo-code.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [PromoCodeModule, NotificationModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}

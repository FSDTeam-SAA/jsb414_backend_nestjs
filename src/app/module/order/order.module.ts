import { Module } from '@nestjs/common';
import { PromoCodeModule } from '../promo-code/promo-code.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [PromoCodeModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}

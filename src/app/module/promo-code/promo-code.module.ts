import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { PromoCodeController } from './promo-code.controller';
import { PromoCodeService } from './promo-code.service';

@Module({
  imports: [PrismaModule],
  controllers: [PromoCodeController],
  providers: [PromoCodeService],
  exports: [PromoCodeService],
})
export class PromoCodeModule {}

import { Module } from '@nestjs/common';
import { AgePriceService } from './age-price.service';
import { AgePriceController } from './age-price.controller';

@Module({
  controllers: [AgePriceController],
  providers: [AgePriceService],
})
export class AgePriceModule {}

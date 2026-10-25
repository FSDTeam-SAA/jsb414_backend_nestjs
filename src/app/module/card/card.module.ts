// src/app/module/card/card.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CardController } from './card.controller';
import { CardService } from './card.service';

@Module({
  imports: [PrismaModule],
  controllers: [CardController],
  providers: [CardService],
  exports: [CardService],
})
export class CardModule {}

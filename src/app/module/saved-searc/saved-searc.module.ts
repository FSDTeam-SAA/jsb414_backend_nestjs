import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { SavedSearcController } from './saved-searc.controller';
import { SavedSearcService } from './saved-searc.service';

@Module({
  imports: [PrismaModule, MarketplaceModule],
  controllers: [SavedSearcController],
  providers: [SavedSearcService],
  exports: [SavedSearcService],
})
export class SavedSearcModule {}

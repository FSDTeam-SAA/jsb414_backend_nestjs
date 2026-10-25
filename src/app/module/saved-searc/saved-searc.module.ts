import { Module } from '@nestjs/common';
import { SavedSearcService } from './saved-searc.service';
import { SavedSearcController } from './saved-searc.controller';

@Module({
  controllers: [SavedSearcController],
  providers: [SavedSearcService],
})
export class SavedSearcModule {}

import { Module } from '@nestjs/common';
import { ContactupService } from './contactup.service';
import { ContactupController } from './contactup.controller';

@Module({
  controllers: [ContactupController],
  providers: [ContactupService],
})
export class ContactupModule {}

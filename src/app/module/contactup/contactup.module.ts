import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { ContactupController } from './contactup.controller';
import { ContactupService } from './contactup.service';

@Module({
  imports: [NotificationModule],
  controllers: [ContactupController],
  providers: [ContactupService],
})
export class ContactupModule {}

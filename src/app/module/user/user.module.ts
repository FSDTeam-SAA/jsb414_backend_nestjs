import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [NotificationModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}

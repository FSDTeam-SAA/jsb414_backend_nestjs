import { Module } from '@nestjs/common';
import { AddAdminService } from './add-admin.service';
import { AddAdminController } from './add-admin.controller';

@Module({
  controllers: [AddAdminController],
  providers: [AddAdminService],
})
export class AddAdminModule {}

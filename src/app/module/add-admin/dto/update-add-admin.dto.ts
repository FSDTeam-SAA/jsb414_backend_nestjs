import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { AdminPermission, CreateAddAdminDto } from './create-add-admin.dto';

export class UpdateAddAdminDto extends PartialType(CreateAddAdminDto) {
  @ApiPropertyOptional({
    example: [
      AdminPermission.LEADS,
      AdminPermission.CUSTOMERS,
      AdminPermission.ORDERS,
    ],
    enum: AdminPermission,
    isArray: true,
    description: 'Updated permissions for this admin',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  permissions?: AdminPermission[];
}

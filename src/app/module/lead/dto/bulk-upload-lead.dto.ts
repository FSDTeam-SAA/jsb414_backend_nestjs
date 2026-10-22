import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BulkUploadLeadDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'CSV (.csv) or Excel (.xlsx, .xls) file containing leads data',
  })
  file?: any;

  @ApiPropertyOptional({
    example: 'b2f6c0b3-1e5b-4c28-9846-52c6f103d3c7',
    description:
      'Default Category ID to assign if not specified per row in the spreadsheet',
  })
  @IsOptional()
  @IsString()
  defaultCategoryId?: string;
}

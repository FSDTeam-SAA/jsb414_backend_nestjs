import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateSavedSearcDto {
  @ApiProperty({
    example: 'Miami Foreclosures - Deals',
    description: 'Custom title for this saved search',
  })
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  title!: string;

  @ApiProperty({
    example: {
      city: 'Miami',
      state: 'FL',
      propertyType: 'Condominium',
      categoryId: 'd060fbee-39bc-44fe-ab7e-aaf5f12b806d',
    },
    description: 'Marketplace filter parameters to store',
  })
  @IsObject()
  @IsNotEmpty({ message: 'filters object is required' })
  filters!: Record<string, any>;
}

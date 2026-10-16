import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SubscriptionQueryDto {
  @IsOptional() @IsString() @MaxLength(100) searchTerm?: string;
  @IsOptional() @IsString() @MaxLength(100) title?: string;
  @IsOptional() @IsString() @MaxLength(500) subTitle?: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  // Boolean('false') is true; convert only the two explicit query values.
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'title', 'price', 'discount'])
  sortBy?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder?: string;
}

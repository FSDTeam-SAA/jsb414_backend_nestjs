import { PartialType } from '@nestjs/swagger';
import { MarketplaceQueryDto } from './create-marketplace.dto';

export class UpdateMarketplaceDto extends PartialType(MarketplaceQueryDto) {}

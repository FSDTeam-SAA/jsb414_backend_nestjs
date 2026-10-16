import { PartialType } from '@nestjs/swagger';
import { CreateAgePriceDto } from './create-age-price.dto';

export class UpdateAgePriceDto extends PartialType(CreateAgePriceDto) {}

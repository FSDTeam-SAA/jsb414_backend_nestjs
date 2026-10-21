import { Controller } from '@nestjs/common';
import { AgePriceService } from './age-price.service';

@Controller('age-price')
export class AgePriceController {
  constructor(private readonly agePriceService: AgePriceService) {}
}

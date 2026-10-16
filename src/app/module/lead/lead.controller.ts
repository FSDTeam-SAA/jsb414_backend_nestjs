import { Controller } from '@nestjs/common';
import { LeadService } from './lead.service';

@Controller('lead')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}
}

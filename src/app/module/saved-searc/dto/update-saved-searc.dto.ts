import { PartialType } from '@nestjs/swagger';
import { CreateSavedSearcDto } from './create-saved-searc.dto';

export class UpdateSavedSearcDto extends PartialType(CreateSavedSearcDto) {}

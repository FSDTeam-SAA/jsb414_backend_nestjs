import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AgePriceService } from './age-price.service';
import { CreateAgePriceDto } from './dto/create-age-price.dto';
import { UpdateAgePriceDto } from './dto/update-age-price.dto';

@Controller('age-price')
export class AgePriceController {
  constructor(private readonly agePriceService: AgePriceService) {}

  @Post()
  create(@Body() createAgePriceDto: CreateAgePriceDto) {
    return this.agePriceService.create(createAgePriceDto);
  }

  @Get()
  findAll() {
    return this.agePriceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.agePriceService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAgePriceDto: UpdateAgePriceDto) {
    return this.agePriceService.update(+id, updateAgePriceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.agePriceService.remove(+id);
  }
}

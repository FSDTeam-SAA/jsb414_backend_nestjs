import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SavedSearcService } from './saved-searc.service';
import { CreateSavedSearcDto } from './dto/create-saved-searc.dto';
import { UpdateSavedSearcDto } from './dto/update-saved-searc.dto';

@Controller('saved-searc')
export class SavedSearcController {
  constructor(private readonly savedSearcService: SavedSearcService) {}

  @Post()
  create(@Body() createSavedSearcDto: CreateSavedSearcDto) {
    return this.savedSearcService.create(createSavedSearcDto);
  }

  @Get()
  findAll() {
    return this.savedSearcService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.savedSearcService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSavedSearcDto: UpdateSavedSearcDto) {
    return this.savedSearcService.update(+id, updateSavedSearcDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.savedSearcService.remove(+id);
  }
}

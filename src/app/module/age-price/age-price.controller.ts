import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { AgePriceService } from './age-price.service';
import { CreateAgePriceDto } from './dto/create-age-price.dto';
import { UpdateAgePriceDto } from './dto/update-age-price.dto';

@ApiTags('Age Price Rules')
@Controller('age-price')
export class AgePriceController {
  constructor(private readonly agePriceService: AgePriceService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create an age-based discount rule (e.g. 8 to 30 days: 15% discount)',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('superadmin', 'admin'))
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAgePriceDto: CreateAgePriceDto) {
    const result = await this.agePriceService.createAgePrice(createAgePriceDto);
    return {
      message: 'Age price rule created successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all age-based discount rules',
  })
  @HttpCode(HttpStatus.OK)
  async findAll() {
    const result = await this.agePriceService.findAllAgePrice();
    return {
      message: 'Age price rules fetched successfully',
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single age price rule by ID' })
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.agePriceService.findOne(id);
    return {
      message: 'Age price rule fetched successfully',
      data: result,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update age price rule (Super Admin only)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('superadmin'))
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAgePriceDto: UpdateAgePriceDto,
  ) {
    const result = await this.agePriceService.update(id, updateAgePriceDto);
    return {
      message: 'Age price rule updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete age price rule (Super Admin only)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('superadmin'))
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.agePriceService.remove(id);
    return result;
  }
}

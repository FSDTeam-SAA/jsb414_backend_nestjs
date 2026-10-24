import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import pick from 'src/app/helper/pick';
import { MarketplaceService } from './marketplace.service';

@ApiTags('Customer Marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all marketplace leads (pre-purchase masked/safe view)',
  })
  @ApiQuery({ name: 'searchTerm', required: false, type: 'string' })
  @ApiQuery({ name: 'categoryId', required: false, type: 'string' })
  @ApiQuery({ name: 'city', required: false, type: 'string' })
  @ApiQuery({ name: 'state', required: false, type: 'string' })
  @ApiQuery({ name: 'county', required: false, type: 'string' })
  @ApiQuery({ name: 'zipcode', required: false, type: 'string' })
  @ApiQuery({ name: 'propertyType', required: false, type: 'string' })
  @ApiQuery({ name: 'stage', required: false, type: 'string' })
  @ApiQuery({ name: 'availability', required: false, type: 'string' })
  @ApiQuery({ name: 'page', required: false, type: 'number' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiQuery({ name: 'sortBy', required: false, type: 'string' })
  @ApiQuery({ name: 'sortOrder', required: false, type: 'string' })
  @HttpCode(HttpStatus.OK)
  async getAllMarketPlace(@Req() req: Request) {
    const filters = pick(req.query, [
      'searchTerm',
      'categoryId',
      'city',
      'state',
      'county',
      'zipcode',
      'propertyType',
      'stage',
      'availability',
    ]);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

    const result = await this.marketplaceService.getAllMarketPlace(
      filters,
      options,
    );

    return {
      message: 'Marketplace leads fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get single lead preview for drawer (pre-purchase masked view)',
  })
  @HttpCode(HttpStatus.OK)
  async getSingleMarketplaceLead(@Param('id') id: string) {
    const result = await this.marketplaceService.getSingleMarketplaceLead(id);

    return {
      message: 'Marketplace lead preview fetched successfully',
      data: result,
    };
  }
}

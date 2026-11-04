import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import pick from 'src/app/helper/pick';
import { MarketplaceService } from './marketplace.service';
import { AuthGuard } from '../../middlewares/auth.guard';

@ApiTags('Customer Marketplace')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard())
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
  @ApiQuery({ name: 'freshness', required: false, enum: ['today', 'last7Days', 'last30Days', 'custom'] })
  @ApiQuery({ name: 'createdFrom', required: false, type: 'string', description: 'ISO date or date-time' })
  @ApiQuery({ name: 'createdTo', required: false, type: 'string', description: 'ISO date or date-time' })
  @ApiQuery({ name: 'minEstValue', required: false, type: 'number' })
  @ApiQuery({ name: 'maxEstValue', required: false, type: 'number' })
  @ApiQuery({ name: 'minEstEquity', required: false, type: 'number' })
  @ApiQuery({ name: 'maxEstEquity', required: false, type: 'number' })
  @ApiQuery({ name: 'minMortgageBalance', required: false, type: 'number' })
  @ApiQuery({ name: 'maxMortgageBalance', required: false, type: 'number' })
  @ApiQuery({ name: 'contactData', required: false, enum: ['phone', 'email', 'both'] })
  @ApiQuery({ name: 'minPrice', required: false, type: 'number' })
  @ApiQuery({ name: 'maxPrice', required: false, type: 'number' })
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
      'freshness',
      'createdFrom',
      'createdTo',
      'minEstValue',
      'maxEstValue',
      'minEstEquity',
      'maxEstEquity',
      'minMortgageBalance',
      'maxMortgageBalance',
      'contactData',
      'minPrice',
      'maxPrice',
    ]);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

    const result = await this.marketplaceService.getAllMarketPlace(
      filters,
      options,
      req.user!.id,
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
  async getSingleMarketplaceLead(@Param('id') id: string, @Req() req: Request) {
    const result = await this.marketplaceService.getSingleMarketplaceLead(
      id,
      req.user!.id,
    );

    return {
      message: 'Marketplace lead preview fetched successfully',
      data: result,
    };
  }
}

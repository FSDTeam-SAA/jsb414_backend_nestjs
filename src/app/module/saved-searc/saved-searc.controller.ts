import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import pick from 'src/app/helper/pick';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { CreateSavedSearcDto } from './dto/create-saved-searc.dto';
import { SavedSearcService } from './saved-searc.service';

@ApiTags('Saved Searches')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard())
@Controller('saved-search')
export class SavedSearcController {
  constructor(private readonly savedSearcService: SavedSearcService) {}

  @Post()
  @ApiOperation({ summary: 'Save marketplace search filters' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request,
    @Body() createSavedSearcDto: CreateSavedSearcDto,
  ) {
    const userId = req.user!.id;
    const result = await this.savedSearcService.createSavedSearch(
      userId,
      createSavedSearcDto,
    );
    return {
      message: 'Search saved successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all saved searches for logged-in user' })
  @HttpCode(HttpStatus.OK)
  async findAll(@Req() req: Request) {
    const userId = req.user!.id;
    const params = pick(req.query, ['title']);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.savedSearcService.getSavedSearches(
      userId,
      params,
      options,
    );
    return {
      message: 'Saved searches fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Post('trigger-digest')
  @ApiOperation({
    summary: 'Manually trigger daily saved-searches matching digest (Admin/Dev)',
    description:
      'Checks all saved searches against leads added in last 24h and sends notification alerts.',
  })
  @HttpCode(HttpStatus.OK)
  async triggerDigest() {
    const result = await this.savedSearcService.triggerDailyDigest();
    return {
      message: result.message,
      data: result,
    };
  }

  @Get(':id/new-leads')
  @ApiOperation({
    summary: 'Get new leads matching this saved search added in the last 24 hours',
  })
  @HttpCode(HttpStatus.OK)
  async getNewLeads(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user!.id;
    const result = await this.savedSearcService.getNewMatchingLeads(userId, id);
    return {
      message: 'New matching leads fetched successfully',
      data: result,
    };
  }

  @Get(':id/results')
  @ApiOperation({ summary: 'Get live marketplace results for a saved search' })
  @HttpCode(HttpStatus.OK)
  async findResults(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user!.id;
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.savedSearcService.getSavedSearchResults(
      userId,
      id,
      options,
    );
    return {
      message: 'Live results fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saved search' })
  @HttpCode(HttpStatus.OK)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user!.id;
    await this.savedSearcService.deleteSavedSearch(userId, id);
    return {
      message: 'Saved search deleted successfully',
    };
  }
}

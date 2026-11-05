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
  Query,
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
import pick from '../../helper/pick';
import { AuthGuard } from '../../middlewares/auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../middlewares/permissions.guard';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { PromoCodeQueryDto } from './dto/promo-code-query.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { ValidatePromoCodeDto } from './dto/validate-promo-code.dto';
import { PromoCodeService } from './promo-code.service';

@ApiTags('Promo Codes & Coupons')
@Controller('promo-code')
export class PromoCodeController {
  constructor(private readonly promoCodeService: PromoCodeService) {}

  // =========================================================================
  // ইউজার এন্ডপয়েন্ট: চেকআউটের সময় কোড ভ্যালিডেশন প্রিভিউ
  // =========================================================================

  @Post('validate')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Validate and calculate discount for a promo code at checkout (User)',
  })
  @HttpCode(HttpStatus.OK)
  async validatePromoCode(
    @Req() req: Request,
    @Body() dto: ValidatePromoCodeDto,
  ) {
    const userId = req.user?.id;
    const result = await this.promoCodeService.validatePromoCode(userId, dto);
    return {
      message: result.message,
      data: result,
    };
  }

  // =========================================================================
  // অ্যাডমিন এন্ডপয়েন্ট (Figma Frame 2147236425 - "Dashboard-- Promo Code")
  // =========================================================================

  @Post()
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('PRICING')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a new promo code (Admin)',
  })
  @HttpCode(HttpStatus.CREATED)
  async createPromoCode(@Body() dto: CreatePromoCodeDto) {
    const result = await this.promoCodeService.createPromoCode(dto);
    return {
      message: result.message,
      data: result.data,
    };
  }

  @Get()
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('PRICING')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get all promo codes with search and pagination (Admin)',
  })
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  @HttpCode(HttpStatus.OK)
  async getAllPromoCodes(@Query() query: PromoCodeQueryDto) {
    const filters = pick(query, ['searchTerm', 'isActive']);
    const options = pick(query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.promoCodeService.getAllPromoCodes(filters, options);

    return {
      message: 'Promo codes fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('PRICING')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get single promo code with recent usage history (Admin)',
  })
  @HttpCode(HttpStatus.OK)
  async getSinglePromoCode(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.promoCodeService.getSinglePromoCode(id);
    return {
      message: 'Promo code details fetched successfully',
      data: result,
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('PRICING')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update promo code details (Admin)',
  })
  @HttpCode(HttpStatus.OK)
  async updatePromoCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromoCodeDto,
  ) {
    const result = await this.promoCodeService.updatePromoCode(id, dto);
    return {
      message: result.message,
      data: result.data,
    };
  }

  @Patch(':id/toggle-status')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('PRICING')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Toggle active/inactive status (Turn ON/OFF) of promo code (Admin)',
  })
  @HttpCode(HttpStatus.OK)
  async togglePromoCodeStatus(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.promoCodeService.togglePromoCodeStatus(id);
    return {
      message: result.message,
      data: result.data,
    };
  }

  @Delete(':id')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('PRICING')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete or deactivate promo code (Admin)',
  })
  @HttpCode(HttpStatus.OK)
  async deletePromoCode(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.promoCodeService.deletePromoCode(id);
    return {
      message: result.message,
    };
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import pick from 'src/app/helper/pick';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { AdminAdjustWalletDto } from './dto/admin-adjust-wallet.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { WalletService } from './wallet.service';

@ApiTags('Customer Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get current user wallet balance' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard())
  @HttpCode(HttpStatus.OK)
  async getBalance(@Req() req: Request) {
    const userId = req.user!.id;
    const result = await this.walletService.getBalance(userId);
    return {
      message: 'Wallet balance fetched successfully',
      data: result,
    };
  }

  @Post('add-funds')
  @ApiOperation({
    summary: 'Create Stripe checkout for prepaid account credit (USD)',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard())
  @HttpCode(HttpStatus.CREATED)
  async addFunds(@Req() req: Request, @Body() dto: CreateWalletDto) {
    const userId = req.user!.id;
    const result = await this.walletService.addFunds(userId, dto);
    return {
      message:
        'Funding request processed; account credit is added only after verified payment',
      data: result,
    };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard())
  @HttpCode(HttpStatus.OK)
  async getTransactions(@Req() req: Request) {
    const userId = req.user!.id;
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.walletService.getTransactions(userId, options);
    return {
      message: 'Transactions fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Post('admin/adjust')
  @ApiOperation({
    summary: 'Super Admin manual account-credit adjustment in USD',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('superadmin'))
  @HttpCode(HttpStatus.OK)
  async adminAdjustBalance(
    @Req() req: Request,
    @Body() dto: AdminAdjustWalletDto,
  ) {
    const result = await this.walletService.adminAdjustBalance(
      req.user!.id,
      dto,
    );
    return {
      message: 'Wallet balance adjusted successfully',
      data: result,
    };
  }
}

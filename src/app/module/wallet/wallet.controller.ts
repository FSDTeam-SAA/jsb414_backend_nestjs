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
  @ApiOperation({ summary: 'Add funds to wallet (e.g. $100, $250, $500)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard())
  @HttpCode(HttpStatus.CREATED)
  async addFunds(@Req() req: Request, @Body() dto: CreateWalletDto) {
    const userId = req.user!.id;
    const result = await this.walletService.addFunds(userId, dto);
    return {
      message: 'Funds added successfully',
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
    summary: 'Admin manual balance adjustment (Admin/Superadmin only)',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @HttpCode(HttpStatus.OK)
  async adminAdjustBalance(@Body() dto: AdminAdjustWalletDto) {
    const result = await this.walletService.adminAdjustBalance(dto);
    return {
      message: 'Wallet balance adjusted successfully',
      data: result,
    };
  }
}

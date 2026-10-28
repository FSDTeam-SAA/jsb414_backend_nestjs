// src/app/module/card/card.controller.ts
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
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { CardService } from './card.service';
import { AddToCartDto, AddToCartMultipolDto } from './dto/add-to-cart.dto';
import { BulkAddToCartDto } from './dto/bulk-add-to-cart.dto';

@ApiTags('Customer Cart')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard()) // শুধুমাত্র লগইন করা কাস্টমাররা কার্ট ব্যবহার করতে পারবে
@Controller('cart')
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Post('items')
  @ApiOperation({
    summary: 'Add a single lead to cart (Shared or Exclusive)',
  })
  @HttpCode(HttpStatus.CREATED)
  async addToCart(@Req() req: Request, @Body() dto: AddToCartDto) {
    const userId = req.user!.id;
    const result = await this.cardService.addToCart(userId, dto);
    return {
      message: 'Lead added to cart successfully',
      data: result,
    };
  }

  @Post('multiple')
  @ApiOperation({
    summary: 'Add multiple selected leads to cart',
  })
  async addToCartMultipol(
    @Req() req: Request,
    @Body() dto: AddToCartMultipolDto,
  ) {
    const result = await this.cardService.addToCartMultipol(req.user!.id, dto);

    return {
      message: 'Leads added to cart successfully',
      data: result,
    };
  }

  @Post('bulk')
  @ApiOperation({
    summary:
      'Make bulk order: Auto-pick newest eligible leads (e.g. 50, 100, 250)',
  })
  @HttpCode(HttpStatus.CREATED)
  async bulkAddToCart(@Req() req: Request, @Body() dto: BulkAddToCartDto) {
    const userId = req.user!.id;
    const result = await this.cardService.bulkAddToCart(userId, dto);
    return {
      // message: `${result.addedCount} lead(s) added to your cart`,
      message: `lead(s) added to your cart`,
      data: result,
    };
  }

  @Get()
  @ApiOperation({
    summary:
      'View customer cart with live pricing, discounts, and wallet balance',
  })
  @HttpCode(HttpStatus.OK)
  async getCart(@Req() req: Request) {
    const userId = req.user!.id;
    const result = await this.cardService.getCart(userId);
    return {
      message: 'Cart fetched successfully',
      data: result,
    };
  }

  @Delete('items/:id')
  @ApiOperation({
    summary: 'Remove a single item from cart',
  })
  @HttpCode(HttpStatus.OK)
  async removeFromCart(@Req() req: Request, @Param('id') cartItemId: string) {
    const userId = req.user!.id;
    const result = await this.cardService.removeFromCart(userId, cartItemId);
    return {
      message: 'Item removed from cart',
      data: result,
    };
  }

  @Delete('clear')
  @ApiOperation({
    summary: 'Clear all items in cart',
  })
  @HttpCode(HttpStatus.OK)
  async clearCart(@Req() req: Request) {
    const userId = req.user!.id;
    await this.cardService.clearCart(userId);
    return {
      message: 'Cart cleared successfully',
    };
  }
}

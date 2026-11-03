import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query, 
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import pick from '../../helper/pick';
import { AuthGuard } from '../../middlewares/auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../middlewares/permissions.guard';
import { CheckoutOrderDto } from './dto/checkout-order.dto';
import { MyLeadsQueryDto } from './dto/my-leads-query.dto';
import { MyOrdersQueryDto } from './dto/my-orders-query.dto';
import { OrderService } from './order.service';

@ApiTags('Orders & Purchased Leads')
@ApiBearerAuth('access-token')
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // ১. কার্ট থেকে অর্ডার চেকআউট (Wallet, Stripe card বা Split payment)
  @Post('checkout')
  @UseGuards(AuthGuard())
  @ApiOperation({
    summary: 'Checkout cart items (Wallet, Stripe Card, or Split Payment)',
  })
  @HttpCode(HttpStatus.OK)
  async checkout(@Req() req: Request, @Body() dto: CheckoutOrderDto) {
    const userId = req.user!.id;
    const result = await this.orderService.checkout(userId, dto);
    return {
      message: result.message,
      data: result,
    };
  }

  // ২. ইউজারের কেনা লিডের পূর্ণ তালিকা (আনমাস্কড ডেটাসহ)
  @Get('my-leads')
  @UseGuards(AuthGuard())
  @ApiOperation({
    summary:
      'Get all purchased leads with full unmasked details (Owner, Address, Phone, Email)',
  })
  @HttpCode(HttpStatus.OK)
  async getMyLeads(@Req() req: Request, @Query() query: MyLeadsQueryDto) {
    const userId = req.user!.id;
    const filters = pick(query, ['searchTerm', 'city', 'state', 'priceType']);
    const options = pick(query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.orderService.getMyLeads(userId, filters, options);

    return {
      message: 'Purchased leads fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  // ৩. ইউজারের কেনা লিড CSV ফরম্যাটে ডাউনলোড
  @Get('my-leads/export')
  @UseGuards(AuthGuard())
  @ApiOperation({
    summary: 'Export all purchased leads as a clean CSV file',
  })
  async exportMyLeadsCsv(@Req() req: Request, @Res() res: Response) {
    const userId = req.user!.id;
    return this.orderService.exportMyLeadsCsv(userId, res);
  }

  // ৪. লগইন করা কাস্টমারের অর্ডার হিস্ট্রি (My Orders)
  @Get('my-orders')
  @UseGuards(AuthGuard())
  @ApiOperation({
    summary: 'Get order history for logged-in user',
  })
  @HttpCode(HttpStatus.OK)
  async getMyOrders(@Req() req: Request, @Query() query: MyOrdersQueryDto) {
    const userId = req.user!.id;
    const filters = pick(query, ['searchTerm', 'status']);
    const options = pick(query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.orderService.getMyOrders(userId, filters, options);

    return {
      message: 'Orders fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  // ৫. অ্যাডমিনের জন্য সকল কাস্টমারের অর্ডার তালিকা
  @Get('admin/all-orders')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('ORDERS')
  @ApiOperation({
    summary: 'Get all customer orders (Admin/SuperAdmin only)',
  })
  @HttpCode(HttpStatus.OK)
  async getAllOrdersAdmin(@Query() query: MyOrdersQueryDto) {
    const filters = pick(query, ['searchTerm', 'status']);
    const options = pick(query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.orderService.getAllOrdersAdmin(filters, options);

    return {
      message: 'All customer orders fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  // ৬. একক অর্ডারের ইনভয়েস ও বিস্তারিত বিবরণ
  @Get(':id')
  @UseGuards(AuthGuard())
  @ApiOperation({
    summary: 'Get single order details and invoice by order ID',
  })
  @HttpCode(HttpStatus.OK)
  async getOrderById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = req.user!.id;
    const result = await this.orderService.getOrderById(id, userId);

    return {
      message: 'Order details fetched successfully',
      data: result,
    };
  }
}

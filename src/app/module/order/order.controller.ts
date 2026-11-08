import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  ReviewBadLeadRequestDto,
  SubmitBadLeadRequestDto,
} from './dto/bad-lead-request.dto';
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

    // ৪.১ কাস্টমারের অর্ডার ওভারভিউ এবং সামারি কার্ডস (My Orders Summary)
  @Get('my-orders/summary')
  @UseGuards(AuthGuard())
  @ApiOperation({
    summary:
      'Get customer order summary cards (Total Orders, Total Purchased Leads, Total Spent, & Wallet Balance)',
  })
  @HttpCode(HttpStatus.OK)
  async getMyOrderSummary(@Req() req: Request) {
    const userId = req.user!.id;
    const result = await this.orderService.myOrder(userId);
    return {
      message: 'My order summary fetched successfully',
      data: result,
    };
  }

  // ৪.২ অ্যালিয়াস এন্ডপয়েন্ট: /order/my-order
  @Get('my-order')
  @UseGuards(AuthGuard())
  @ApiOperation({
    summary:
      'Get customer order summary cards (Alias for /order/my-orders/summary)',
  })
  @HttpCode(HttpStatus.OK)
  async myOrder(@Req() req: Request) {
    const userId = req.user!.id;
    const result = await this.orderService.myOrder(userId);
    return {
      message: 'My order summary fetched successfully',
      data: result,
    };
  }

  // ৪.৩ লগইন করা কাস্টমারের অর্ডার হিস্ট্রি (My Orders)
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
    const filters = pick(query, [
      'searchTerm',
      'status',
      'startDate',
      'endDate',
      'leadType',
      'propertyType',
      'availability',
    ]);
    const options = pick(query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.orderService.getAllOrdersAdmin(filters, options);

    return {
      message: 'All customer orders fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  // ৭. কাস্টমার কর্তৃক ব্যাড লিড / ক্রেডিট রিকোয়েস্ট সাবমিট করা (৭ দিনের মধ্যে)
  @Post('bad-lead-request')
  @UseGuards(AuthGuard())
  @ApiOperation({
    summary:
      'Customer submits a Bad Lead / Credit Request (within 7 days of purchase)',
  })
  @HttpCode(HttpStatus.CREATED)
  async submitBadLeadRequest(
    @Req() req: Request,
    @Body() dto: SubmitBadLeadRequestDto,
  ) {
    const userId = req.user!.id;
    return this.orderService.submitBadLeadRequest(userId, dto);
  }

  // ৮. অ্যাডমিনের জন্য সকল ব্যাড লিড রিকোয়েস্টের তালিকা
  @Get('admin/bad-lead-requests')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('SUPPORT')
  @ApiOperation({
    summary: 'Admin lists all Bad Lead / Credit Requests',
  })
  @HttpCode(HttpStatus.OK)
  async getAllBadLeadRequestsAdmin(@Query() query: any) {
    const filters = pick(query, ['status', 'reason']);
    const options = pick(query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.orderService.getAllBadLeadRequestsAdmin(
      filters,
      options,
    );
    return {
      message: 'Bad lead requests fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  // ৯. অ্যাডমিন কর্তৃক ব্যাড লিড রিকোয়েস্ট অ্যাপ্রুভ বা রিজেক্ট করা
  @Patch('admin/bad-lead-request/:id/review')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('SUPPORT')
  @ApiOperation({
    summary:
      'Admin approves (returns account credit to wallet) or rejects a Bad Lead Request',
  })
  @HttpCode(HttpStatus.OK)
  async reviewBadLeadRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Body() dto: ReviewBadLeadRequestDto,
  ) {
    const reviewerId = req.user!.id;
    return this.orderService.reviewBadLeadRequest(id, reviewerId, dto);
  }

  // ৬. একক অর্ডারের ইনভয়েস ও বিস্তারিত বিবরণ
  @Get(':id')
  @UseGuards(AuthGuard())
  @ApiOperation({
    summary: 'Get single order details and invoice by order ID or order number',
  })
  @HttpCode(HttpStatus.OK)
  async getOrderById(
    @Param('id') id: string,
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

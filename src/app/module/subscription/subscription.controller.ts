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
import { CreateSubscriptionPaymentDto } from './dto/create-subscription-payment.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionQueryDto } from './dto/subscription-query.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionService } from './subscription.service';

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @ApiOperation({ summary: 'Get all subscription plans (Admin)' })
  @ApiQuery({
    name: 'searchTerm',
    description: 'Search by title, subTitle or currency',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'title',
    description: 'Filter by title',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'subTitle',
    description: 'Filter by subTitle',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'currency',
    description: 'Filter by currency',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'isActive',
    description: 'Filter by isActive',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Limit per page',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Sort by field',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'sortOrder',
    description: 'Sort order',
    required: false,
    type: String,
  })
  @HttpCode(HttpStatus.OK)
  async getSubscribes(@Query() query: SubscriptionQueryDto) {
    const filters = pick(query, [
      'searchTerm',
      'title',
      'subTitle',
      'currency',
      'isActive',
    ]);
    const params = pick(query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.subscriptionService.getAllSubscribes(
      filters,
      params,
    );

    return {
      message: 'Subscription plans fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create subscription plan (Admin)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @HttpCode(HttpStatus.CREATED)
  async createSubscribe(
    @Req() req: Request,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return {
      message: 'Subscription plan created successfully',
      data: await this.subscriptionService.createSubscribe(req.user!.id, dto),
    };
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get public active plans (Free, Silver, Gold, Diamond)',
  })
  async getActivePlans() {
    return {
      message: 'Active plans fetched successfully',
      data: await this.subscriptionService.getActivePlans(),
    };
  }

  @Post('payment')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Select plan & create Stripe checkout URL (Free plan activates immediately)',
  })
  @HttpCode(HttpStatus.OK)
  async createSubscriptionPayment(
    @Req() req: Request,
    @Body() dto: CreateSubscriptionPaymentDto,
  ) {
    const userId = req.user!.id;
    const result = await this.subscriptionService.createSubscriptionPayment(
      userId,
      dto,
    );
    return {
      message: result.message,
      data: result,
    };
  }

  @Get('overview')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @ApiOperation({
    summary: 'Get subscription dashboard overview metrics (Admin)',
    description:
      'Fetches active paid members count, silver/gold/diamond members count, and total/tier-wise subscription revenues.',
  })
  @HttpCode(HttpStatus.OK)
  async subscripeOverview() {
    const result = await this.subscriptionService.subscripeOverview();
    return {
      message: 'Subscription overview fetched successfully',
      data: result,
    };
  }

  @Get('recent-users')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @ApiOperation({
    summary: 'Get recent subscribed users (Admin)',
    description:
      'Fetches recent subscription payment transactions with user profiles and subscription plan details.',
  })
  @ApiQuery({
    name: 'searchTerm',
    description: 'Search by user name, email or phone',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by status',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'subscribeId',
    description: 'Filter by subscription plan ID',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'paymentType',
    description: 'Filter by payment type',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Limit per page',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Sort by field',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'sortOrder',
    description: 'Sort order',
    required: false,
    type: String,
  })
  @HttpCode(HttpStatus.OK)
  async recentSubscribeTionUser(@Req() req: Request) {
    const filters = pick(req.query, [
      'searchTerm',
      'status',
      'subscribeId',
      'paymentType',
      'receiptUrl',
    ]);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.subscriptionService.recentSubscribeTionUser(
      filters,
      options,
    );

    return {
      message: 'Recent subscription users fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @ApiOperation({ summary: 'Get subscription plan by id' })
  @HttpCode(HttpStatus.OK)
  async getSubscribeById(@Param('id', ParseUUIDPipe) id: string) {
    return {
      message: 'Subscription plan fetched successfully',
      data: await this.subscriptionService.singleSubscribe(id),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update or deactivate subscription plan' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  async updateSubscribe(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return {
      message: 'Subscription plan updated successfully',
      data: await this.subscriptionService.updateSubscribe(
        req.user!.id,
        id,
        dto,
      ),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subscription plan' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  async deleteSubscribe(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      message: 'Subscription plan deleted successfully',
      data: await this.subscriptionService.deleteSubscribe(req.user!.id, id),
    };
  }
}

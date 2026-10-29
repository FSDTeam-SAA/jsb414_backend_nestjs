import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import buildWhereConditions from '../../helper/buildWhereConditions';
import paginationHelper, { IOptions } from '../../helper/pagenation';
import { IFilterParams } from '../../helper/pick';
import { PrismaService } from '../../../prisma/prisma.service';
import config from '../../config';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CreateSubscriptionPaymentDto } from './dto/create-subscription-payment.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  private getStripe() {
    if (!config.stripe.secretKey) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
    return new Stripe(config.stripe.secretKey);
  }

  private async checkAdmin(adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || !['admin', 'superadmin'].includes(admin.role)) {
      throw new ForbiddenException('Only admins can manage subscription plans');
    }
  }

  async createSubscribe(adminId: string, dto: CreateSubscriptionDto) {
    await this.checkAdmin(adminId);
    return this.prisma.subscribe.create({
      data: {
        title: dto.title,
        subTitle: dto.subTitle,
        price: dto.price,
        discount: dto.discount,
        createdById: adminId,
      },
    });
  }

  async getAllSubscribes(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);
    const whenCondition = buildWhereConditions(params, [
      'title',
      'subTitle',
      'currency',
    ]);
    const [result, total] = await Promise.all([
      this.prisma.subscribe.findMany({
        where: whenCondition,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.subscribe.count({
        where: whenCondition,
      }),
    ]);

    return {
      data: result,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  getActivePlans() {
    return this.prisma.subscribe.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
      take: 100,
      select: {
        id: true,
        title: true,
        subTitle: true,
        price: true,
        discount: true,
        currency: true,
      },
    });
  }

  async singleSubscribe(id: string) {
    const result = await this.prisma.subscribe.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException('Subscription plan not found');
    }
    return result;
  }

  async updateSubscribe(
    adminId: string,
    id: string,
    dto: UpdateSubscriptionDto,
  ) {
    await this.checkAdmin(adminId);
    return this.prisma.subscribe.update({
      where: { id },
      data: {
        title: dto.title,
        subTitle: dto.subTitle,
        price: dto.price,
        discount: dto.discount,
        isActive: dto.isActive,
        updatedById: adminId,
      },
    });
  }

  async deleteSubscribe(adminId: string, id: string) {
    await this.checkAdmin(adminId);
    const exist = await this.prisma.subscribe.findUnique({
      where: { id },
    });
    if (!exist) {
      throw new NotFoundException('Subscription plan not found');
    }

    const subscribersCount = await this.prisma.userSubscribe.count({
      where: { subscribeId: id },
    });
    if (subscribersCount > 0) {
      throw new BadRequestException(
        'Cannot delete subscription plan because users have already subscribed to it. Please deactivate (set isActive: false) instead.',
      );
    }

    return this.prisma.subscribe.delete({
      where: { id },
    });
  }

  // --- সাবস্ক্রিপশন পেমেন্ট ও অ্যাক্টিভেশন (Add Funds-এর মতো সেম ফরম্যাটে) ---

  async createSubscriptionPayment(
    userId: string,
    dto: CreateSubscriptionPaymentDto,
  ) {
    const plan = await this.prisma.subscribe.findUnique({
      where: { id: dto.subscribeId },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException('Subscription plan not found or inactive');
    }

    const priceNum = Number(plan.price);

    // ১. ফ্রি প্ল্যান ($0) হলে কোনো পেমেন্ট লাগবে না—সরাসরি সাবস্ক্রিপশন সক্রিয় হবে
    if (priceNum === 0) {
      const now = new Date();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const existingSubscription = await this.prisma.userSubscribe.findFirst({
        where: { userId },
      });

      let userSubscribe;
      if (existingSubscription) {
        userSubscribe = await this.prisma.userSubscribe.update({
          where: { id: existingSubscription.id },
          data: {
            subscribeId: plan.id,
            status: 'ACTIVE',
            startDate: now,
            endDate,
          },
        });
      } else {
        userSubscribe = await this.prisma.userSubscribe.create({
          data: {
            userId,
            subscribeId: plan.id,
            status: 'ACTIVE',
            startDate: now,
            endDate,
          },
        });
      }

      return {
        message: 'Free subscription activated successfully',
        checkoutUrl: null,
        plan: {
          id: plan.id,
          title: plan.title,
          discount: plan.discount,
        },
        userSubscribe,
      };
    }

    // ২. পেইড প্ল্যান ($49, $99, $149) হলে Stripe Checkout Session URL তৈরি করবে
    const stripe = this.getStripe();
    const amountCents = Math.round(priceNum * 100);

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        subscribeId: plan.id,
        amount: plan.price,
        currency: plan.currency || 'USD',
        paymentType: 'SUBSCRIPTION',
        status: 'PENDING',
      },
    });

    const frontendUrl = config.frontendUrl.replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      allowed_payment_method_types: ['card'],
      client_reference_id: userId,
      metadata: {
        purpose: 'SUBSCRIPTION',
        userId,
        subscribeId: plan.id,
        paymentId: payment.id,
      },
      line_items: [
        {
          price_data: {
            currency: (plan.currency || 'usd').toLowerCase(),
            unit_amount: amountCents,
            product_data: {
              name: `${plan.title} Membership - Foreclosure Gold`,
              description:
                plan.subTitle || `${plan.title} Subscription Membership`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/subscription/cancel`,
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { stripeSessionId: session.id },
    });

    return {
      message: 'Subscription checkout session created successfully',
      checkoutUrl: session.url,
      paymentId: payment.id,
      plan: {
        id: plan.id,
        title: plan.title,
        price: priceNum,
        discount: plan.discount,
      },
    };
  }
}

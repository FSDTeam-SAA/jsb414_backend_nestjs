import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import Stripe from 'stripe';
import { LeadAvailability } from '../../../../prisma/generated/prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import config from '../../config';
import paginationHelper, { IOptions } from '../../helper/pagenation';
import { IFilterParams } from '../../helper/pick';
import {
  calculateDynamicLeadPrice,
  inventoryAge,
} from '../../helper/pricing.helper';
import { CheckoutOrderDto } from './dto/checkout-order.dto';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  private getStripe() {
    if (!config.stripe.secretKey) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
    return new Stripe(config.stripe.secretKey);
  }

  // ইউজারের বর্তমান মেম্বারশিপ এবং ডিসকাউন্ট নেওয়া
  private currentMembership(userId: string) {
    const now = new Date();
    return this.prisma.userSubscribe.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'CANCELLED'] },
        startDate: { lte: now },
        endDate: { gt: now },
      },
      orderBy: { endDate: 'desc' },
      include: { subscribe: true },
    });
  }

  // ১. কার্ট থেকে অর্ডার চেকআউট (Wallet ব্যালেন্স অথবা Stripe কার্ড পেমেন্ট)
  async checkout(userId: string, dto: CheckoutOrderDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, walletBalance: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const cartWhere: any = { userId };
    if (dto.cartItemIds && dto.cartItemIds.length > 0) {
      cartWhere.id = { in: dto.cartItemIds };
    }

    const cartItems = await this.prisma.cartItem.findMany({
      where: cartWhere,
      include: {
        lead: {
          include: { category: true },
        },
      },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException(
        'Your cart is empty or selected items were not found',
      );
    }

    const [globalRules, membership] = await Promise.all([
      this.prisma.agePriceRule.findMany({ orderBy: { minDays: 'asc' } }),
      this.currentMembership(userId),
    ]);
    const discountPercent = membership?.subscribe?.discount || 0;

    let subtotal = 0;
    let totalDiscount = 0;
    let totalAmount = 0;

    const preparedItems: {
      leadId: string;
      priceType: LeadAvailability;
      originalPrice: number;
      discount: number;
      pricePaid: number;
    }[] = [];

    // ইনভেন্টরি যাচাই ও দাম হিসাব
    for (const item of cartItems) {
      const lead = item.lead;

      // অলরেডি এই ইউজার কিনেছে কিনা
      const alreadyPurchased = await this.prisma.userLead.findUnique({
        where: {
          userId_leadId: {
            userId,
            leadId: lead.id,
          },
        },
      });
      if (alreadyPurchased) {
        throw new BadRequestException(
          `Lead #${lead.leadNumber} is already purchased by you`,
        );
      }

      // লিড সক্রিয় এবং সেলযোগ্য কিনা
      if (
        lead.status !== 'ACTIVE' ||
        lead.classification !== 'SELLABLE' ||
        !lead.category.isActive
      ) {
        throw new BadRequestException(
          `Lead #${lead.leadNumber} is no longer available for purchase`,
        );
      }

      // এভেইলেবিলিটি চেক
      if (item.priceType === 'EXCLUSIVE') {
        if (lead.exclusiveSoldAt !== null || lead.availability === 'SHARED') {
          throw new BadRequestException(
            `Lead #${lead.leadNumber} is not available for exclusive purchase`,
          );
        }
      } else {
        if (lead.exclusiveSoldAt !== null || lead.availability === 'EXCLUSIVE') {
          throw new BadRequestException(
            `Lead #${lead.leadNumber} has been exclusively sold`,
          );
        }
        if (
          lead.sharedLimit !== null &&
          lead.sharedSalesCount >= lead.sharedLimit
        ) {
          throw new BadRequestException(
            `Lead #${lead.leadNumber} has reached its shared purchase limit`,
          );
        }
      }

      // ফাইনাল ডায়নামিক প্রাইস হিসাব
      const prices = calculateDynamicLeadPrice({
        categorySharedBasePrice: lead.category.sharedBasePrice,
        categoryExclusiveBasePrice: lead.category.exclusiveBasePrice,
        agePricingEnabled: lead.category.agePricingEnabled,
        agePriceRules: globalRules,
        ageInDays: inventoryAge(lead.createdAt),
        userDiscountPercent: discountPercent,
      });

      const original =
        item.priceType === 'EXCLUSIVE'
          ? prices.originalExclusive
          : prices.originalShared;
      const final =
        item.priceType === 'EXCLUSIVE'
          ? prices.finalExclusive
          : prices.finalShared;

      if (original === null || final === null) {
        throw new BadRequestException(
          `Price not configured for lead #${lead.leadNumber}`,
        );
      }

      const originalNum = Number(original);
      const finalNum = Number(final);
      const disc = Math.round((originalNum - finalNum) * 100) / 100;

      subtotal += originalNum;
      totalDiscount += disc;
      totalAmount += finalNum;

      preparedItems.push({
        leadId: lead.id,
        priceType: item.priceType,
        originalPrice: originalNum,
        discount: disc,
        pricePaid: finalNum,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    totalDiscount = Math.round(totalDiscount * 100) / 100;
    totalAmount = Math.round(totalAmount * 100) / 100;

    const walletBalance = Number(user.walletBalance || 0);
    const useWallet = dto.useWallet !== false;
    const walletUsed = useWallet ? Math.min(walletBalance, totalAmount) : 0;
    const cardNeeded = Math.round((totalAmount - walletUsed) * 100) / 100;
    const orderNumber = `FG-ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // কেইস ১: সম্পূর্ণ ওয়ালেট পেমেন্ট (১০০% Wallet Paid)
    if (cardNeeded === 0) {
      const order = await this.prisma.$transaction(async (tx) => {
        if (walletUsed > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { walletBalance: { decrement: walletUsed } },
          });
        }

        const newOrder = await tx.order.create({
          data: {
            userId,
            orderNumber,
            subtotal,
            discount: totalDiscount,
            totalAmount,
            walletUsed,
            cardPaid: 0,
            status: 'COMPLETED',
          },
        });

        await tx.orderItem.createMany({
          data: preparedItems.map((pi) => ({
            orderId: newOrder.id,
            leadId: pi.leadId,
            priceType: pi.priceType,
            originalPrice: pi.originalPrice,
            discount: pi.discount,
            pricePaid: pi.pricePaid,
          })),
        });

        for (const pi of preparedItems) {
          await tx.userLead.create({
            data: {
              userId,
              leadId: pi.leadId,
              priceType: pi.priceType,
              pricePaid: pi.pricePaid,
              orderId: newOrder.id,
            },
          });

          if (pi.priceType === 'EXCLUSIVE') {
            await tx.lead.update({
              where: { id: pi.leadId },
              data: { exclusiveSoldAt: new Date() },
            });
          } else {
            await tx.lead.update({
              where: { id: pi.leadId },
              data: { sharedSalesCount: { increment: 1 } },
            });
          }
        }

        if (walletUsed > 0) {
          await tx.walletTransaction.create({
            data: {
              userId,
              amount: walletUsed,
              balanceAfter: walletBalance - walletUsed,
              type: 'PURCHASE',
              referenceId: newOrder.id,
              operationKey: `order:${newOrder.id}`,
              description: `Lead purchase Order #${newOrder.orderNumber}`,
            },
          });
        }

        const processedLeadIds = preparedItems.map((p) => p.leadId);
        await tx.cartItem.deleteMany({
          where: {
            userId,
            leadId: { in: processedLeadIds },
          },
        });

        return newOrder;
      });

      return {
        message: 'Order completed successfully using wallet balance',
        orderId: order.id,
        orderNumber: order.orderNumber,
        checkoutUrl: null,
        totalAmount,
        walletUsed,
        cardPaid: 0,
        itemsCount: preparedItems.length,
      };
    }

    // কেইস ২: Stripe কার্ড পেমেন্ট প্রয়োজন
    const stripe = this.getStripe();
    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          orderNumber,
          subtotal,
          discount: totalDiscount,
          totalAmount,
          walletUsed,
          cardPaid: cardNeeded,
          status: 'PENDING',
        },
      });

      await tx.orderItem.createMany({
        data: preparedItems.map((pi) => ({
          orderId: newOrder.id,
          leadId: pi.leadId,
          priceType: pi.priceType,
          originalPrice: pi.originalPrice,
          discount: pi.discount,
          pricePaid: pi.pricePaid,
        })),
      });

      return newOrder;
    });

    const frontendUrl = config.frontendUrl.replace(/\/$/, '');
    const amountCents = Math.round(cardNeeded * 100);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      allowed_payment_method_types: ['card'],
      client_reference_id: userId,
      metadata: {
        purpose: 'ORDER_PURCHASE',
        orderId: order.id,
        userId,
        walletUsed: String(walletUsed),
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `Foreclosure Gold - Order #${order.orderNumber}`,
              description: `Purchase of ${preparedItems.length} property lead(s)`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/order/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
      cancel_url: `${frontendUrl}/order/cancel?order_id=${order.id}`,
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentId: session.id },
    });

    return {
      message: 'Order created. Please proceed to Stripe payment.',
      orderId: order.id,
      orderNumber: order.orderNumber,
      checkoutUrl: session.url,
      totalAmount,
      walletUsed,
      cardPaid: cardNeeded,
      itemsCount: preparedItems.length,
    };
  }

  // ২. ইউজারের কেনা লিডের আনমাস্কড তালিকা (My Purchased Leads)
  async getMyLeads(userId: string, params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortOrder } = paginationHelper(options);
    const sortField =
      options.sortBy && ['purchasedAt', 'pricePaid'].includes(options.sortBy)
        ? options.sortBy
        : 'purchasedAt';

    const andConditions: any[] = [{ userId }];

    if (params.priceType) {
      andConditions.push({ priceType: params.priceType });
    }

    if (params.city) {
      andConditions.push({
        lead: { city: { equals: params.city.trim(), mode: 'insensitive' } },
      });
    }

    if (params.state) {
      andConditions.push({
        lead: { state: { equals: params.state.trim(), mode: 'insensitive' } },
      });
    }

    if (params.searchTerm) {
      andConditions.push({
        OR: [
          {
            lead: {
              firstName: { contains: params.searchTerm, mode: 'insensitive' },
            },
          },
          {
            lead: {
              lastName: { contains: params.searchTerm, mode: 'insensitive' },
            },
          },
          {
            lead: {
              propertyAddress: {
                contains: params.searchTerm,
                mode: 'insensitive',
              },
            },
          },
          {
            lead: {
              city: { contains: params.searchTerm, mode: 'insensitive' },
            },
          },
          {
            lead: {
              state: { contains: params.searchTerm, mode: 'insensitive' },
            },
          },
          {
            lead: {
              zipcode: { contains: params.searchTerm, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    const where = { AND: andConditions };

    const [userLeads, total] = await Promise.all([
      this.prisma.userLead.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortField]: sortOrder || 'desc',
        },
        include: {
          lead: {
            include: {
              category: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      this.prisma.userLead.count({ where }),
    ]);

    const formatted = userLeads.map((ul) => ({
      id: ul.id,
      leadId: ul.leadId,
      priceType: ul.priceType,
      pricePaid: Number(ul.pricePaid),
      purchasedAt: ul.purchasedAt,
      orderId: ul.orderId,
      lead: {
        id: ul.lead.id,
        leadNumber: ul.lead.leadNumber,
        category: ul.lead.category,
        firstName: ul.lead.firstName,
        lastName: ul.lead.lastName,
        propertyAddress: ul.lead.propertyAddress,
        unitNumber: ul.lead.unitNumber,
        city: ul.lead.city,
        county: ul.lead.county,
        state: ul.lead.state,
        zipcode: ul.lead.zipcode,
        propertyType: ul.lead.propertyType,
        propertyImage: ul.lead.propertyImage,
        estValue: ul.lead.estValue,
        estEquity: ul.lead.estEquity,
        mortgageBalance: ul.lead.mortgageBalance,
        saleDate: ul.lead.saleDate,
        stage: ul.lead.stage,
        mortgageInformation: ul.lead.mortgageInformation,
        phoneNumbers: ul.lead.phoneNumbers,
        emailAddresses: ul.lead.emailAddresses,
        source: ul.lead.source,
      },
    }));

    return {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: formatted,
    };
  }

  // ৩. কেনা লিড এক ক্লিকে CSV ডাউনলোড
  async exportMyLeadsCsv(userId: string, res: Response) {
    const userLeads = await this.prisma.userLead.findMany({
      where: { userId },
      orderBy: { purchasedAt: 'desc' },
      include: {
        lead: {
          include: { category: true },
        },
      },
    });

    const headers = [
      'Lead Number',
      'Category',
      'Purchase Type',
      'First Name',
      'Last Name',
      'Property Address',
      'Unit Number',
      'City',
      'County',
      'State',
      'Zip Code',
      'Property Type',
      'Estimated Value',
      'Estimated Equity',
      'Mortgage Balance',
      'Stage',
      'Phone Numbers',
      'Email Addresses',
      'Price Paid',
      'Purchased Date',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = Array.isArray(val) ? val.join('; ') : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = userLeads.map((ul) => {
      const l = ul.lead;
      return [
        l.leadNumber,
        l.category?.name || '',
        ul.priceType,
        l.firstName || '',
        l.lastName || '',
        l.propertyAddress || '',
        l.unitNumber || '',
        l.city || '',
        l.county || '',
        l.state || '',
        l.zipcode || '',
        l.propertyType || '',
        l.estValue ? `$${l.estValue}` : '',
        l.estEquity ? `$${l.estEquity}` : '',
        l.mortgageBalance ? `$${l.mortgageBalance}` : '',
        l.stage || '',
        l.phoneNumbers || [],
        l.emailAddresses || [],
        `$${Number(ul.pricePaid).toFixed(2)}`,
        new Date(ul.purchasedAt).toISOString().split('T')[0],
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const today = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="my-leads-${today}.csv"`,
    );
    res.send(csvContent);
  }

  // ৪. ইউজারের অর্ডার হিস্ট্রি (My Orders)
  async getMyOrders(userId: string, params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortOrder } = paginationHelper(options);
    const sortField =
      options.sortBy && ['createdAt', 'totalAmount'].includes(options.sortBy)
        ? options.sortBy
        : 'createdAt';

    const andConditions: any[] = [{ userId }];

    if (params.status) {
      andConditions.push({ status: params.status });
    }

    if (params.searchTerm) {
      andConditions.push({
        orderNumber: { contains: params.searchTerm, mode: 'insensitive' },
      });
    }

    const where = { AND: andConditions };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortField]: sortOrder || 'desc',
        },
        include: {
          orderItems: {
            include: {
              lead: {
                select: {
                  id: true,
                  leadNumber: true,
                  city: true,
                  state: true,
                  propertyType: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const formatted = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      subtotal: Number(o.subtotal),
      discount: Number(o.discount),
      totalAmount: Number(o.totalAmount),
      walletUsed: Number(o.walletUsed),
      cardPaid: Number(o.cardPaid),
      status: o.status,
      stripePaymentId: o.stripePaymentId,
      receiptUrl: o.receiptUrl,
      itemsCount: o.orderItems.length,
      items: o.orderItems.map((oi) => ({
        id: oi.id,
        leadId: oi.leadId,
        leadNumber: oi.lead?.leadNumber,
        location: `${oi.lead?.city || ''}, ${oi.lead?.state || ''}`.trim(),
        priceType: oi.priceType,
        originalPrice: Number(oi.originalPrice),
        discount: Number(oi.discount),
        pricePaid: Number(oi.pricePaid),
      })),
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));

    return {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: formatted,
    };
  }

  // ৫. একক অর্ডারের ইনভয়েস ভিউ
  async getOrderById(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            lead: {
              include: {
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      const requester = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!requester || !['admin', 'superadmin'].includes(requester.role)) {
        throw new ForbiddenException('You do not have access to this order');
      }
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      user: order.user,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      totalAmount: Number(order.totalAmount),
      walletUsed: Number(order.walletUsed),
      cardPaid: Number(order.cardPaid),
      status: order.status,
      stripePaymentId: order.stripePaymentId,
      receiptUrl: order.receiptUrl,
      items: order.orderItems.map((oi) => ({
        id: oi.id,
        leadId: oi.leadId,
        leadNumber: oi.lead?.leadNumber,
        category: oi.lead?.category?.name,
        priceType: oi.priceType,
        originalPrice: Number(oi.originalPrice),
        discount: Number(oi.discount),
        pricePaid: Number(oi.pricePaid),
        propertyAddress: oi.lead?.propertyAddress,
        city: oi.lead?.city,
        state: oi.lead?.state,
        zipcode: oi.lead?.zipcode,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  // ৬. অ্যাডমিনের জন্য সব কাস্টমারের অর্ডারের তালিকা
  async getAllOrdersAdmin(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortOrder } = paginationHelper(options);
    const sortField =
      options.sortBy && ['createdAt', 'totalAmount'].includes(options.sortBy)
        ? options.sortBy
        : 'createdAt';

    const andConditions: any[] = [];
    if (params.status) {
      andConditions.push({ status: params.status });
    }
    if (params.searchTerm) {
      andConditions.push({
        OR: [
          { orderNumber: { contains: params.searchTerm, mode: 'insensitive' } },
          {
            user: {
              email: { contains: params.searchTerm, mode: 'insensitive' },
            },
          },
          {
            user: {
              firstName: { contains: params.searchTerm, mode: 'insensitive' },
            },
          },
          {
            user: {
              lastName: { contains: params.searchTerm, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortField]: sortOrder || 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          orderItems: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        user: o.user,
        subtotal: Number(o.subtotal),
        discount: Number(o.discount),
        totalAmount: Number(o.totalAmount),
        walletUsed: Number(o.walletUsed),
        cardPaid: Number(o.cardPaid),
        status: o.status,
        itemsCount: o.orderItems.length,
        createdAt: o.createdAt,
      })),
    };
  }
}

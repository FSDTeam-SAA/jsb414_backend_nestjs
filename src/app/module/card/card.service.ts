// src/app/module/card/card.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '../../../../prisma/generated/prisma/client';
import {
  calculateDynamicLeadPrice,
  inventoryAge,
} from '../../helper/pricing.helper';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { BulkAddToCartDto } from './dto/bulk-add-to-cart.dto';

@Injectable()
export class CardService {
  constructor(private readonly prisma: PrismaService) {}

  async addToCart(userId: string, addToCartDto: AddToCartDto) {
    const lead = await this.prisma.lead.findUnique({
      where: {
        id: addToCartDto.leadId,
      },
      include: {
        category: { include: { agePriceRules: true } },
      },
    });
    if (
      !lead ||
      lead.status !== 'ACTIVE' ||
      lead.classification !== 'SELLABLE' ||
      !lead.category.isActive
    ) {
      throw new NotFoundException(
        'Lead not found or is currently not available for purchase',
      );
    }

    const alreadyPurchased = await this.prisma.userLead.findUnique({
      where: {
        userId_leadId: {
          userId,
          leadId: addToCartDto.leadId,
        },
      },
    });

    if (alreadyPurchased) {
      throw new BadRequestException(
        'You have already purchased this lead previously',
      );
    }

    if (addToCartDto.priceType === 'EXCLUSIVE') {
      if (lead.exclusiveSoldAt !== null || lead.availability === 'SHARED') {
        throw new BadRequestException(
          'This lead is not available for exclusive purchase',
        );
      }
    } else {
      if (lead.availability === 'EXCLUSIVE' || lead.exclusiveSoldAt !== null) {
        throw new BadRequestException(
          'This lead is already exclusively purchased and cannot be shared',
        );
      }
      if (lead.sharedLimit && lead.sharedSalesCount >= lead.sharedLimit) {
        throw new BadRequestException(
          'This lead has reached its maximum shared purchase limit',
        );
      }
    }

    const selectedPrices = this.leadPrices(lead, 0);
    const selectedPrice =
      addToCartDto.priceType === 'EXCLUSIVE'
        ? selectedPrices.finalExclusive
        : selectedPrices.finalShared;
    if (selectedPrice === null) {
      throw new BadRequestException(
        'Category price is not configured for this purchase type',
      );
    }

    const cartItem = await this.prisma.cartItem.upsert({
      where: {
        userId_leadId: {
          userId,
          leadId: addToCartDto.leadId,
        },
      },
      create: {
        userId,
        leadId: addToCartDto.leadId,
        priceType: addToCartDto.priceType ?? 'SHARED',
      },
      update: {
        priceType: addToCartDto.priceType,
      },
      include: {
        lead: {
          select: {
            id: true,
            leadNumber: true,
            city: true,
            state: true,
            county: true,
            zipcode: true,
            propertyType: true,
            stage: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    const membership = await this.currentMembership(userId);
    const prices = this.leadPrices(lead, membership?.subscribe.discount ?? 0);
    return {
      ...cartItem,
      lead: {
        ...cartItem.lead,
        sharedPrice:
          lead.availability === 'EXCLUSIVE' ? null : prices.finalShared,
        exclusivePrice:
          lead.availability === 'SHARED' ? null : prices.finalExclusive,
        currency: 'USD',
      },
    };
  }

  async bulkAddToCart(userId: string, bulkAddToCartDto: BulkAddToCartDto) {
    const userLeads = await this.prisma.userLead.findMany({
      where: {
        userId: userId,
      },
      select: {
        leadId: true,
      },
    });

    const existingInCart = await this.prisma.cartItem.findMany({
      where: {
        userId,
      },
      select: {
        leadId: true,
      },
    });

    const excludedLeadIds = [...userLeads, ...existingInCart].map(
      (item) => item.leadId,
    );

    const whereCondition: any = {
      status: 'ACTIVE',
      classification: 'SELLABLE',
      category: {
        isActive: true,
      },
      id: {
        notIn: excludedLeadIds,
      },
    };

    if (bulkAddToCartDto.categoryId) {
      whereCondition.categoryId = bulkAddToCartDto.categoryId;
    }

    if (bulkAddToCartDto.state) {
      whereCondition.state = {
        equals: bulkAddToCartDto.state.trim(),
        mode: 'insensitive',
      };
    }

    if (bulkAddToCartDto.city) {
      whereCondition.city = {
        equals: bulkAddToCartDto.city.trim(),
        mode: 'insensitive',
      };
    }

    if (bulkAddToCartDto.priceType === 'EXCLUSIVE') {
      whereCondition.exclusiveSoldAt = null;
      whereCondition.availability = { in: ['EXCLUSIVE', 'BOTH'] };
    } else {
      whereCondition.exclusiveSoldAt = null;
      whereCondition.availability = { in: ['SHARED', 'BOTH'] };
    }

    const eligibleLeads = await this.prisma.lead.findMany({
      where: whereCondition,
      take: bulkAddToCartDto.quantity,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });

    if (eligibleLeads.length === 0) {
      return {
        addedCount: 0,
        requestedQuantity: bulkAddToCartDto.quantity,
      };
    }

    await this.prisma.cartItem.createMany({
      data: eligibleLeads.map((lead) => ({
        userId,
        leadId: lead.id,
        priceType: bulkAddToCartDto.priceType ?? 'SHARED',
      })),
      skipDuplicates: true,
    });

    return {
      addedCount: eligibleLeads.length,
      requestedQuantity: bulkAddToCartDto.quantity,
    };
  }
  // =========================================================================
  // ৩. কার্ট ভিউ (সব আইটেম, ডিসকাউন্ট, অ্যাকাউন্ট ব্যালেন্স ও সামারি)
  // =========================================================================
  async getCart(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const membership = await this.currentMembership(userId);
    const discountPercent = membership?.subscribe.discount ?? 0;
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        lead: { include: { category: { include: { agePriceRules: true } } } },
      },
    });
    let subtotal = new Prisma.Decimal(0);
    let discount = new Prisma.Decimal(0);
    const items = cartItems.map((item) => {
      const lead = item.lead;
      const prices = this.leadPrices(lead, discountPercent);
      const exclusive = item.priceType === 'EXCLUSIVE';
      const original = exclusive
        ? prices.originalExclusive
        : prices.originalShared;
      const final = exclusive ? prices.finalExclusive : prices.finalShared;
      const saving = exclusive
        ? prices.exclusiveDiscount
        : prices.sharedDiscount;
      const modeAvailable = exclusive
        ? lead.availability !== 'SHARED'
        : lead.availability !== 'EXCLUSIVE' &&
          (lead.sharedLimit === null ||
            lead.sharedSalesCount < lead.sharedLimit);
      const available =
        lead.status === 'ACTIVE' &&
        lead.classification === 'SELLABLE' &&
        lead.category.isActive &&
        lead.exclusiveSoldAt === null &&
        modeAvailable &&
        final !== null;
      if (available && original !== null) {
        subtotal = subtotal.plus(original);
        discount = discount.plus(saving);
      }
      return {
        cartItemId: item.id,
        leadId: lead.id,
        leadNumber: lead.leadNumber,
        location:
          `${lead.city ?? ''}, ${lead.state ?? ''} ${lead.zipcode?.slice(0, 3) ?? ''}XX`.trim(),
        propertyType: lead.propertyType,
        stage: lead.stage,
        categoryName: lead.category.name,
        priceType: item.priceType,
        originalPrice: original,
        discount: saving,
        finalPrice: final,
        available,
        currency: 'USD',
        addedAt: item.createdAt,
      };
    });
    return {
      summary: {
        totalItems: items.length,
        unavailableItems: items.filter((item) => !item.available).length,
        subtotal,
        discount,
        total: subtotal.minus(discount),
        walletBalance: user.walletBalance,
        currency: 'USD',
        appliedDiscountPercent: discountPercent,
        hasActiveSubscription: Boolean(membership),
        subscriptionName: membership?.subscribe.title ?? null,
      },
      items,
    };
  }

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

  private leadPrices(lead: any, discountPercent: number) {
    return calculateDynamicLeadPrice({
      categorySharedBasePrice: lead.category.sharedBasePrice,
      categoryExclusiveBasePrice: lead.category.exclusiveBasePrice,
      agePricingEnabled: lead.category.agePricingEnabled,
      agePriceRules: lead.category.agePriceRules,
      ageInDays: inventoryAge(lead.createdAt),
      userDiscountPercent: discountPercent,
    });
  }

  async removeFromCart(userId: string, cartItemId: string) {
    const existing = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        userId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Cart item not found');
    }

    return await this.prisma.cartItem.delete({
      where: { id: cartItemId },
    });
  }

  // =========================================================================
  // ৫. পুরো কার্ট খালি করা
  // =========================================================================
  async clearCart(userId: string) {
    return await this.prisma.cartItem.deleteMany({
      where: { userId },
    });
  }
}

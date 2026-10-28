// src/app/module/card/card.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
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
        category: true,
      },
    });
    if (
      !lead ||
      lead.status !== 'ACTIVE' ||
      lead.classification !== 'SELLABLE'
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
            sharedBasePriceCents: true,
            exclusiveBasePriceCents: true,
            category: {
              select: {
                id: true,
                name: true,
                sharedBasePriceCents: true,
                exclusiveBasePriceCents: true,
              },
            },
          },
        },
      },
    });

    // Cart responses use dollars; category/lead inventory storage still uses cents.
    const { lead: cartLead, ...item } = cartItem;
    const sharedPrice =
      cartLead.sharedBasePriceCents ?? cartLead.category.sharedBasePriceCents;
    const exclusivePrice =
      cartLead.exclusiveBasePriceCents ??
      cartLead.category.exclusiveBasePriceCents;
    return {
      ...item,
      lead: {
        id: cartLead.id,
        leadNumber: cartLead.leadNumber,
        city: cartLead.city,
        state: cartLead.state,
        county: cartLead.county,
        zipcode: cartLead.zipcode,
        propertyType: cartLead.propertyType,
        stage: cartLead.stage,
        sharedPrice: sharedPrice === null ? null : sharedPrice / 100,
        exclusivePrice: exclusivePrice === null ? null : exclusivePrice / 100,
        currency: 'USD',
        category: { id: cartLead.category.id, name: cartLead.category.name },
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

    // ৩.২ কাস্টমারের কোনো অ্যাক্টিভ মেম্বারশিপ টায়ার ও ডিসকাউন্ট আছে কিনা চেক
    const activeSub = await this.prisma.userSubscribe.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        subscribe: true,
      },
    });

    const discountPercent = activeSub?.subscribe?.discount ?? 0;

    // ৩.৩ কার্টের আইটেমগুলো আনা
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
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
            availability: true,
            sharedBasePriceCents: true,
            exclusiveBasePriceCents: true,
            category: {
              select: {
                id: true,
                name: true,
                sharedBasePriceCents: true,
                exclusiveBasePriceCents: true,
              },
            },
          },
        },
      },
    });

    // ৩.৪ প্রতিটি আইটেমের জন্য লাইভ প্রাইস ও ডিসকাউন্ট হিসাব
    let subtotalCents = 0;
    let totalDiscountCents = 0;

    const items = cartItems.map((item) => {
      const lead = item.lead;
      const isExclusive = item.priceType === 'EXCLUSIVE';

      // বেস প্রাইস: লিডের নিজস্ব প্রাইস থাকলে সেটা, নয়তো ক্যাটাগরির প্রাইস
      const basePrice = isExclusive
        ? (lead.exclusiveBasePriceCents ??
          lead.category?.exclusiveBasePriceCents ??
          5000)
        : (lead.sharedBasePriceCents ??
          lead.category?.sharedBasePriceCents ??
          2000);

      const discountCents = Math.round((basePrice * discountPercent) / 100);
      const finalPrice = Math.max(0, basePrice - discountCents);

      subtotalCents += basePrice;
      totalDiscountCents += discountCents;

      // মাস্কড জিপ কোড (যেমন: 928XX)
      const maskedZip =
        lead.zipcode && lead.zipcode.length >= 3
          ? `${lead.zipcode.slice(0, 3)}XX`
          : '••••';

      return {
        cartItemId: item.id,
        leadId: lead.id,
        leadNumber: lead.leadNumber,
        location: `${lead.city || ''}, ${lead.state || ''} ${maskedZip}`.trim(),
        propertyType: lead.propertyType,
        stage: lead.stage,
        categoryName: lead.category?.name,
        priceType: item.priceType,
        originalPrice: basePrice / 100,
        discount: discountCents / 100,
        finalPrice: finalPrice / 100,
        addedAt: item.createdAt,
      };
    });

    const totalCents = Math.max(0, subtotalCents - totalDiscountCents);

    return {
      summary: {
        totalItems: items.length,
        subtotal: subtotalCents / 100,
        discount: totalDiscountCents / 100,
        total: totalCents / 100,
        walletBalance: user?.walletBalance.toNumber() ?? 0,
        currency: 'USD',
        appliedDiscountPercent: discountPercent,
        hasActiveSubscription: Boolean(activeSub),
        subscriptionName: activeSub?.subscribe?.title || null,
      },
      items,
    };
  }

  // =========================================================================
  // ৪. কার্ট থেকে নির্দিষ্ট একটি আইটেম রিমুভ করা
  // =========================================================================
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

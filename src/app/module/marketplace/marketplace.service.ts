/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/prisma/client';
import buildWhereConditions from 'src/app/helper/buildWhereConditions';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  calculateDynamicLeadPrice,
  inventoryAge,
} from '../../helper/pricing.helper';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  // Same sale rules for list, count, saved searches and single preview.
  private availableLeadConditions(userId: string): Prisma.LeadWhereInput {
    if (!userId) throw new UnauthorizedException('Login is required');

    return {
      status: 'ACTIVE',
      classification: 'SELLABLE',
      category: { isActive: true },
      exclusiveSoldAt: null,
      userLead: { none: { userId } },
      OR: [
        // BOTH may still be purchased exclusively even if Shared slots are full.
        { availability: { in: ['EXCLUSIVE', 'BOTH'] } },
        {
          availability: 'SHARED',
          OR: [
            { sharedLimit: null },
            { sharedSalesCount: { lt: this.prisma.lead.fields.sharedLimit } },
          ],
        },
      ],
    };
  }

  // 1. মার্কেটপ্লেসের সকল লিড লিস্ট (কেনার পূর্বে সেনসিটিভ ডেটা ছাড়া)
  async getAllMarketPlace(
    params: IFilterParams,
    options: IOptions,
    userId: string,
  ) {
    const discountPercent = await this.discountFor(userId);
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);

    const searchableFields = [
      'city',
      'state',
      'county',
      'zipcode',
      'stage',
      'propertyType',
    ];

    const whereConditions = buildWhereConditions(
      params,
      searchableFields,
      this.availableLeadConditions(userId),
    );

    const [globalRules, data, total] = await Promise.all([
      this.prisma.agePriceRule.findMany({
        where: { categoryId: null },
        orderBy: { minDays: 'asc' },
      }),
      this.prisma.lead.findMany({
        where: whereConditions,
        select: {
          id: true,
          leadNumber: true,
          city: true,
          state: true,
          county: true,
          zipcode: true,
          propertyType: true,
          propertyImage: true,
          estValue: true,
          estEquity: true,
          mortgageBalance: true,
          saleDate: true,
          stage: true,
          availability: true,
          sharedLimit: true,
          sharedSalesCount: true,
          createdAt: true,
          category: {
            select: {
              id: true,
              name: true,
              sharedBasePrice: true,
              exclusiveBasePrice: true,
              agePricingEnabled: true,
              agePriceRules: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.lead.count({
        where: whereConditions,
      }),
    ]);

    return {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: data.map((lead) => this.withPrices(lead, discountPercent, globalRules)),
    };
  }

  // 2. ড্রয়ার প্রিভিউ-এর জন্য সিঙ্গেল লিড প্রিভিউ (মাস্কড ডেটা সহ)
  private withPrices(lead: any, discountPercent = 0, globalRules: any[] = []) {
    const rules =
      lead.category.agePriceRules && lead.category.agePriceRules.length > 0
        ? lead.category.agePriceRules
        : globalRules;

    const prices = calculateDynamicLeadPrice({
      categorySharedBasePrice: lead.category.sharedBasePrice,
      categoryExclusiveBasePrice: lead.category.exclusiveBasePrice,
      agePricingEnabled: lead.category.agePricingEnabled,
      agePriceRules: rules,
      ageInDays: inventoryAge(lead.createdAt),
      userDiscountPercent: discountPercent,
    });
    const { sharedLimit: _limit, sharedSalesCount: _count, ...safe } = lead;
    return {
      ...safe,
      category: { id: lead.category.id, name: lead.category.name },
      sharedPrice:
        lead.availability === 'EXCLUSIVE' ||
        (lead.sharedLimit !== null && lead.sharedSalesCount >= lead.sharedLimit)
          ? null
          : prices.finalShared,
      exclusivePrice:
        lead.availability === 'SHARED' ? null : prices.finalExclusive,
      currency: 'USD',
      appliedDiscountPercent: discountPercent,
      appliedAgeDiscountPercent: prices.appliedAgeDiscountPercent,
    };
  }

  async getSingleMarketplaceLead(id: string, userId: string) {
    const discountPercent = await this.discountFor(userId);
    const lead = await this.prisma.lead.findFirst({
      where: {
        id,
        ...this.availableLeadConditions(userId),
      },
      select: {
        id: true,
        leadNumber: true,
        firstName: true,
        lastName: true,
        city: true,
        state: true,
        county: true,
        zipcode: true,
        propertyType: true,
        propertyImage: true,
        estValue: true,
        estEquity: true,
        mortgageBalance: true,
        saleDate: true,
        stage: true,
        phoneNumbers: true,
        emailAddresses: true,
        availability: true,
        sharedLimit: true,
        sharedSalesCount: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
            sharedBasePrice: true,
            exclusiveBasePrice: true,
            agePricingEnabled: true,
            agePriceRules: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found in marketplace');
    }

    // ওনার নাম মাস্কিং: "J•••• S••••"
    const maskedOwner = lead.firstName
      ? `${lead.firstName[0].toUpperCase()}•••• ${lead.lastName ? lead.lastName[0].toUpperCase() + '••••' : ''}`.trim()
      : '••••';

    // ফোন নম্বর মাস্কিং: "(***) ***-4521"
    const maskedPhones = (lead.phoneNumbers || []).map((phone) => {
      const digits = phone.replace(/\D/g, '');
      return digits.length >= 4
        ? `(***) ***-${digits.slice(-4)}`
        : '(***) ***-••••';
    });

    // ইমেইল মাস্কিং: "j••••@gmail.com"
    const maskedEmails = (lead.emailAddresses || []).map((email) => {
      if (!email.includes('@')) return '••••@••••.com';
      const [userPart, domainPart] = email.split('@');
      return `${userPart[0]}••••@${domainPart}`;
    });

    // আসল নাম, ফোন ও ইমেইল বাদ দিয়ে মাস্কড অবজেক্ট রিটার্ন
    const { firstName, lastName, phoneNumbers, emailAddresses, ...safeLead } =
      lead;

    let globalRules: any[] = [];
    if (!lead.category.agePriceRules || lead.category.agePriceRules.length === 0) {
      globalRules = await this.prisma.agePriceRule.findMany({
        where: { categoryId: null },
        orderBy: { minDays: 'asc' },
      });
    }

    return {
      ...this.withPrices(safeLead, discountPercent, globalRules),
      ownerName: maskedOwner,
      streetAddress: 'Hidden Until Purchase',
      maskedPhones,
      maskedEmails,
    };
  }

  private async discountFor(userId?: string) {
    if (!userId) return 0;
    const now = new Date();
    const membership = await this.prisma.userSubscribe.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'CANCELLED'] },
        startDate: { lte: now },
        endDate: { gt: now },
      },
      orderBy: { endDate: 'desc' },
      include: { subscribe: true },
    });
    return membership?.subscribe.discount ?? 0;
  }
}

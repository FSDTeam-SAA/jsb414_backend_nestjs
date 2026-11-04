/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/prisma/client';
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

  private queryValues(value: unknown) {
    const values = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : typeof value === 'string'
        ? value.split(',')
        : [];
    return values
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private queryNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  private queryDate(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private marketplaceWhere(
    params: IFilterParams,
    userId: string,
  ): Prisma.LeadWhereInput {
    const conditions: Prisma.LeadWhereInput[] = [
      this.availableLeadConditions(userId),
    ];
    const searchTerm = typeof params.searchTerm === 'string' ? params.searchTerm.trim() : '';

    if (searchTerm) {
      conditions.push({
        OR: ['city', 'state', 'county', 'zipcode', 'stage', 'propertyType'].map(
          (field) => ({ [field]: { contains: searchTerm, mode: 'insensitive' } }),
        ),
      });
    }

    const categoryIds = this.queryValues(params.categoryId);
    if (categoryIds.length) conditions.push({ categoryId: { in: categoryIds } });

    const availability = this.queryValues(params.availability);
    if (availability.length) conditions.push({ availability: { in: availability as any } });

    (['city', 'state', 'county', 'zipcode', 'propertyType', 'stage'] as const).forEach(
      (field) => {
        const value = typeof params[field] === 'string' ? params[field].trim() : '';
        if (value) conditions.push({ [field]: value });
      },
    );

    const addNumberRange = (field: 'estValue' | 'estEquity' | 'mortgageBalance', minKey: string, maxKey: string) => {
      const gte = this.queryNumber(params[minKey]);
      const lte = this.queryNumber(params[maxKey]);
      if (gte !== undefined || lte !== undefined) conditions.push({ [field]: { ...(gte !== undefined ? { gte } : {}), ...(lte !== undefined ? { lte } : {}) } });
    };
    addNumberRange('estValue', 'minEstValue', 'maxEstValue');
    addNumberRange('estEquity', 'minEstEquity', 'maxEstEquity');
    addNumberRange('mortgageBalance', 'minMortgageBalance', 'maxMortgageBalance');

    const freshness = params.freshness;
    const now = new Date();
    let createdFrom = this.queryDate(params.createdFrom);
    const createdTo = this.queryDate(params.createdTo);
    if (freshness === 'today') createdFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (freshness === 'last7Days') createdFrom = new Date(now.getTime() - 7 * 86_400_000);
    if (freshness === 'last30Days') createdFrom = new Date(now.getTime() - 30 * 86_400_000);
    if (createdFrom || createdTo) conditions.push({ createdAt: { ...(createdFrom ? { gte: createdFrom } : {}), ...(createdTo ? { lte: createdTo } : {}) } });

    if (params.contactData === 'phone') conditions.push({ phoneNumbers: { isEmpty: false } });
    if (params.contactData === 'email') conditions.push({ emailAddresses: { isEmpty: false } });
    if (params.contactData === 'both') conditions.push({ phoneNumbers: { isEmpty: false }, emailAddresses: { isEmpty: false } });

    return { AND: conditions };
  }

  // 1. মার্কেটপ্লেসের সকল লিড লিস্ট (কেনার পূর্বে সেনসিটিভ ডেটা ছাড়া)
  async getAllMarketPlace(
    params: IFilterParams,
    options: IOptions,
    userId: string,
  ) {
    const discountPercent = await this.discountFor(userId);
    const { limit, page, skip, sortBy: requestedSortBy, sortOrder: requestedSortOrder } = paginationHelper(options);
    const sortBy = ['createdAt', 'estValue', 'estEquity', 'mortgageBalance', 'saleDate'].includes(requestedSortBy) ? requestedSortBy : 'createdAt';
    const sortOrder = requestedSortOrder === 'asc' ? 'asc' : 'desc';
    const whereConditions = this.marketplaceWhere(params, userId);
    const select = {
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
      category: { select: { id: true, name: true, sharedBasePrice: true, exclusiveBasePrice: true, agePricingEnabled: true } },
    } as const;
    const minPrice = this.queryNumber(params.minPrice);
    const maxPrice = this.queryNumber(params.maxPrice);
    const hasPriceFilter = minPrice !== undefined || maxPrice !== undefined;

    const [globalRules, data, total] = await Promise.all([
      this.prisma.agePriceRule.findMany({
        orderBy: { minDays: 'asc' },
      }),
      this.prisma.lead.findMany({
        where: whereConditions,
        select,
        ...(hasPriceFilter ? {} : { skip, take: limit }),
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      hasPriceFilter ? Promise.resolve(0) : this.prisma.lead.count({ where: whereConditions }),
    ]);

    const pricedData = data.map((lead) => this.withPrices(lead, discountPercent, globalRules));
    const filteredData = hasPriceFilter
      ? pricedData.filter((lead) => [lead.sharedPrice, lead.exclusivePrice].some((price) => price !== null && (minPrice === undefined || Number(price) >= minPrice) && (maxPrice === undefined || Number(price) <= maxPrice)))
      : pricedData;
    const filteredTotal = hasPriceFilter ? filteredData.length : total;

    return {
      meta: {
        page,
        limit,
        total: filteredTotal,
        totalPage: Math.ceil(filteredTotal / limit),
      },
      data: hasPriceFilter ? filteredData.slice(skip, skip + limit) : filteredData,
    };
  }

  // 2. ড্রয়ার প্রিভিউ-এর জন্য সিঙ্গেল লিড প্রিভিউ (মাস্কড ডেটা সহ)
  private withPrices(lead: any, discountPercent = 0, globalRules: any[] = []) {
    const prices = calculateDynamicLeadPrice({
      categorySharedBasePrice: lead.category.sharedBasePrice,
      categoryExclusiveBasePrice: lead.category.exclusiveBasePrice,
      agePricingEnabled: lead.category.agePricingEnabled,
      agePriceRules: globalRules,
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

    const globalRules = await this.prisma.agePriceRule.findMany({
      orderBy: { minDays: 'asc' },
    });

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

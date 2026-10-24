/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, NotFoundException } from '@nestjs/common';
import buildWhereConditions from 'src/app/helper/buildWhereConditions';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. মার্কেটপ্লেসের সকল লিড লিস্ট (কেনার পূর্বে সেনসিটিভ ডেটা ছাড়া)
  async getAllMarketPlace(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);

    const searchableFields = [
      'city',
      'state',
      'county',
      'zipcode',
      'stage',
      'propertyType',
    ];

    const whereConditions = buildWhereConditions(params, searchableFields, {
      status: 'ACTIVE',
    });

    const [data, total] = await Promise.all([
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
          sharedBasePriceCents: true,
          exclusiveBasePriceCents: true,
          createdAt: true,
          category: {
            select: {
              id: true,
              name: true,
              sharedBasePriceCents: true,
              exclusiveBasePriceCents: true,
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
      data,
    };
  }

  // 2. ড্রয়ার প্রিভিউ-এর জন্য সিঙ্গেল লিড প্রিভিউ (মাস্কড ডেটা সহ)
  async getSingleMarketplaceLead(id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id,
        status: 'ACTIVE',
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
        sharedBasePriceCents: true,
        exclusiveBasePriceCents: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
            sharedBasePriceCents: true,
            exclusiveBasePriceCents: true,
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
      return digits.length >= 4 ? `(***) ***-${digits.slice(-4)}` : '(***) ***-••••';
    });

    // ইমেইল মাস্কিং: "j••••@gmail.com"
    const maskedEmails = (lead.emailAddresses || []).map((email) => {
      if (!email.includes('@')) return '••••@••••.com';
      const [userPart, domainPart] = email.split('@');
      return `${userPart[0]}••••@${domainPart}`;
    });

    // আসল নাম, ফোন ও ইমেইল বাদ দিয়ে মাস্কড অবজেক্ট রিটার্ন
    const { firstName, lastName, phoneNumbers, emailAddresses, ...safeLead } = lead;

    return {
      ...safeLead,
      ownerName: maskedOwner,
      streetAddress: 'Hidden Until Purchase',
      maskedPhones,
      maskedEmails,
    };
  }
}

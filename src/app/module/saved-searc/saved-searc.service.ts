import { Injectable, NotFoundException } from '@nestjs/common';
import buildWhereConditions from 'src/app/helper/buildWhereConditions';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '../../../../prisma/generated/prisma/browser';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { CreateSavedSearcDto } from './dto/create-saved-searc.dto';

@Injectable()
export class SavedSearcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplaceService: MarketplaceService,
  ) {}

  async createSavedSearch(userId: string, dto: CreateSavedSearcDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result = await this.prisma.savedSearch.create({
      data: {
        userId: user.id,
        title: dto.title,
        filters: dto.filters,
      },
    });

    return result;
  }

  async getSavedSearches(
    userId: string,
    param: IFilterParams,
    options: IOptions,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);

    const whereCondition: Prisma.SavedSearchWhereInput = buildWhereConditions(
      param,
      ['title'],
      {
        userId: user.id,
      },
    );

    const result = await this.prisma.savedSearch.findMany({
      where: whereCondition,
      take: limit,
      skip,
      orderBy: { [sortBy]: sortOrder },
    });

    const total = await this.prisma.savedSearch.count({
      where: whereCondition,
    });

    return {
      data: result,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  // ৩. সেভ করা ফিল্টার দিয়ে লাইভ রেজাল্ট বের করা (মার্কেটপ্লেস সার্ভিস কল করে)
  async getSavedSearchResults(
    userId: string,
    savedSearchId: string,
    options: IOptions,
  ) {
    const savedSearch = await this.prisma.savedSearch.findFirst({
      where: { id: savedSearchId, userId },
    });

    if (!savedSearch) {
      throw new NotFoundException('Saved search not found');
    }

    // সেভ করা ফিল্টারটি নিয়ে সরাসরি MarketplaceService এর getAllMarketPlace ফাংশন কল করা
    const filters = savedSearch.filters as IFilterParams;
    return await this.marketplaceService.getAllMarketPlace(filters, options);
  }

  // ৪. সেভড সার্চ ডিলিট করা
  async deleteSavedSearch(userId: string, savedSearchId: string) {
    const existing = await this.prisma.savedSearch.findFirst({
      where: { id: savedSearchId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Saved search not found');
    }

    return await this.prisma.savedSearch.delete({
      where: { id: savedSearchId },
    });
  }
}

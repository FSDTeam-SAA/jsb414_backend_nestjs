import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import buildWhereConditions from 'src/app/helper/buildWhereConditions';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '../../../../prisma/generated/prisma/browser';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { NotificationService } from '../notification/notification.service';
import { CreateSavedSearcDto } from './dto/create-saved-searc.dto';

@Injectable()
export class SavedSearcService {
  private readonly logger = new Logger(SavedSearcService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplaceService: MarketplaceService,
    @Optional() private readonly notificationService?: NotificationService,
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
    return await this.marketplaceService.getAllMarketPlace(
      filters,
      options,
      userId,
    );
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

  // ৫. সেভড সার্চ অনুযায়ী সাম্প্রতিক (গত ২৪ ঘণ্টায়) নতুন লিড খোঁজা
  async getNewMatchingLeads(userId: string, savedSearchId: string) {
    const savedSearch = await this.prisma.savedSearch.findFirst({
      where: { id: savedSearchId, userId },
    });

    if (!savedSearch) {
      throw new NotFoundException('Saved search not found');
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const filters = (savedSearch.filters || {}) as IFilterParams;

    const result = await this.marketplaceService.getAllMarketPlace(
      { ...filters, createdFrom: since },
      { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' },
      userId,
    );

    return {
      savedSearchId,
      title: savedSearch.title,
      since,
      newLeadsCount: result.meta.total,
      newLeads: result.data,
    };
  }

  // ৬. ডেইলি ডাইজেস্ট ক্রন জব ও ম্যানুয়াল ট্রিগার
  @Cron('0 8 * * *') // প্রতিদিন সকাল ৮:০০ টায় স্বয়ংক্রিয়ভাবে চলবে
  async triggerDailyDigest() {
    this.logger.log('⏰ Running daily saved-searches matching digest...');
    const allSearches = await this.prisma.savedSearch.findMany({
      include: {
        user: { select: { id: true, email: true, firstName: true } },
      },
    });

    if (allSearches.length === 0) {
      return {
        message: 'No saved searches registered.',
        searchesChecked: 0,
        notificationsSent: 0,
      };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let notificationsSent = 0;

    for (const search of allSearches) {
      try {
        const filters = (search.filters || {}) as IFilterParams;
        const match = await this.marketplaceService.getAllMarketPlace(
          { ...filters, createdFrom: since },
          { page: 1, limit: 1 },
          search.userId,
        );

        const count = match.meta?.total || 0;
        if (count > 0 && this.notificationService) {
          await this.notificationService.createNotification({
            userId: search.userId,
            title: 'New Matching Leads Alert',
            message: `Found ${count} new lead(s) matching your saved search "${search.title}". Check them out on the marketplace!`,
            type: 'SAVED_SEARCH_ALERT',
            link: `/marketplace?savedSearchId=${search.id}`,
          });
          notificationsSent++;
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to process saved search ${search.id}:`,
          err?.message || err,
        );
      }
    }

    this.logger.log(
      `✅ Daily digest completed: Checked ${allSearches.length} search(es), sent ${notificationsSent} alert(s).`,
    );

    return {
      message: 'Daily saved searches digest executed successfully',
      searchesChecked: allSearches.length,
      notificationsSent,
    };
  }
}

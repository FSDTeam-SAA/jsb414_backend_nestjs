import { Injectable, NotFoundException } from '@nestjs/common';
import { IOptions } from 'src/app/helper/pagenation';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSavedSearcDto } from './dto/create-saved-searc.dto';
import { IFilterParams } from 'src/app/helper/pick';

@Injectable()
export class SavedSearcService {
  constructor(private readonly prisma: PrismaService) {}

  async createSavedSearch(userId: string, dto: CreateSavedSearcDto) {
    return await this.prisma.savedSearch.create({
      data: {
        userId,
        title: dto.title,
        filters: dto.filters,
      },
    });
  }

  // ২. কাস্টমারের সকল সেভ করা সার্চ লিস্ট
  async getSavedSearches(userId: string) {
    return await this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ৩. সেভ করা ফিল্টার দিয়ে লাইভ রেজাল্ট বের করা (সবচেয়ে আকর্ষণীয় ফিচার)
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

    // সেভ করা ফিল্টারটি নিয়ে সরাসরি আমাদের মার্কেটপ্লেস সার্চ ফাংশনে পাস করা
    const filters = savedSearch.filters as IFilterParams;
    return await this.getAllMarketPlace(filters, options);
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

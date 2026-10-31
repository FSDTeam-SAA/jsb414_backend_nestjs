/* eslint-disable no-useless-assignment */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAgePriceDto } from './dto/create-age-price.dto';
import { UpdateAgePriceDto } from './dto/update-age-price.dto';

@Injectable()
export class AgePriceService {
  constructor(private readonly prisma: PrismaService) {}

  // বয়সের রেঞ্জ ওভারল্যাপ চেক করা (একটি রেঞ্জের ওপর যেন আরেকটি রেঞ্জ ওভারল্যাপ না করে)
  private async checkOverlap(
    minDays: number,
    maxDays?: number | null,
    excludeRuleId?: string,
  ) {
    if (maxDays !== undefined && maxDays !== null && maxDays < minDays) {
      throw new BadRequestException(
        'maxDays must be greater than or equal to minDays',
      );
    }

    const existingRules = await this.prisma.agePriceRule.findMany({
      where: {
        ...(excludeRuleId ? { id: { not: excludeRuleId } } : {}),
      },
    });

    for (const rule of existingRules) {
      const existingMin = rule.minDays;
      const existingMax = rule.maxDays;

      let isOverlapping = false;
      if (maxDays === null || maxDays === undefined) {
        if (existingMax === null) {
          isOverlapping = true;
        } else {
          isOverlapping = existingMax >= minDays;
        }
      } else {
        if (existingMax === null) {
          isOverlapping = maxDays >= existingMin;
        } else {
          isOverlapping = minDays <= existingMax && maxDays >= existingMin;
        }
      }

      if (isOverlapping) {
        const rangeText =
          existingMax === null
            ? `${existingMin}+`
            : `${existingMin}-${existingMax}`;
        throw new ConflictException(
          `This age range overlaps with an existing rule: [${rangeText} days]`,
        );
      }
    }
  }

  // ১. বয়সভিত্তিক ডিসকাউন্ট রুল তৈরি করা
  async createAgePrice(createAgePriceDto: CreateAgePriceDto) {
    await this.checkOverlap(
      createAgePriceDto.minDays,
      createAgePriceDto.maxDays,
    );

    const result = await this.prisma.agePriceRule.create({
      data: {
        minDays: createAgePriceDto.minDays,
        maxDays: createAgePriceDto.maxDays ?? null,
        discountPercent: createAgePriceDto.discountPercent,
      },
    });

    return result;
  }

  // ২. সকল বয়সভিত্তিক রুল দেখা
  async findAllAgePrice() {
    return this.prisma.agePriceRule.findMany({
      orderBy: { minDays: 'asc' },
    });
  }

  // ৩. নির্দিষ্ট একটি রুল দেখা
  async findOne(id: string) {
    const rule = await this.prisma.agePriceRule.findUnique({
      where: { id },
    });
    if (!rule) {
      throw new NotFoundException(`Age price rule with ID ${id} not found`);
    }
    return rule;
  }

  // ৪. রুল আপডেট করা
  async update(id: string, dto: UpdateAgePriceDto) {
    const existingRule = await this.findOne(id);
    const minDays = dto.minDays ?? existingRule.minDays;
    const maxDays =
      dto.maxDays !== undefined ? dto.maxDays : existingRule.maxDays;

    await this.checkOverlap(minDays, maxDays, id);

    return this.prisma.agePriceRule.update({
      where: { id },
      data: {
        ...(dto.minDays !== undefined && { minDays: dto.minDays }),
        ...(dto.maxDays !== undefined && { maxDays: dto.maxDays }),
        ...(dto.discountPercent !== undefined && {
          discountPercent: dto.discountPercent,
        }),
      },
    });
  }

  // ৫. রুল মুছে ফেলা
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.agePriceRule.delete({ where: { id } });
    return { message: 'Age price rule deleted successfully' };
  }

  // নির্দিষ্ট বয়স অনুযায়ী ডিসকাউন্ট পার্সেন্টেজ বের করা
  async getMatchingDiscountPercent(ageInDays: number): Promise<number> {
    const matchingRule = await this.prisma.agePriceRule.findFirst({
      where: {
        minDays: { lte: ageInDays },
        OR: [{ maxDays: { gte: ageInDays } }, { maxDays: null }],
      },
    });

    return matchingRule?.discountPercent ?? 0;
  }
}

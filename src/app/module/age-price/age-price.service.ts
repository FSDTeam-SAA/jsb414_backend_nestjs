import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PriceType } from '../../../../prisma/generated/prisma/enums';
import { CreateAgePriceDto } from './dto/create-age-price.dto';
import { UpdateAgePriceDto } from './dto/update-age-price.dto';

@Injectable()
export class AgePriceService {
  constructor(private readonly prisma: PrismaService) {}


  private async checkOverlap(
    categoryId: string,
    priceType: PriceType,
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
        categoryId,
        priceType,
        ...(excludeRuleId ? { id: { not: excludeRuleId } } : {}),
      },
    });
    for (const rule of existingRules) {
      const existingMin = rule.minDays;
      const existingMax = rule.maxDays;

      // eslint-disable-next-line no-useless-assignment
      let isOverlapping = false;
      if (maxDays === null || maxDays === undefined) {
        // নতুন রুলের কোনো ঊর্ধ্বসীমা নেই (e.g. 91+)
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
          `This age range overlaps with an existing ${priceType} rule: [${rangeText} days] for this category`,
        );
      }
    }
  }

  async createAgePrice(createAgePriceDto: CreateAgePriceDto) {
    const category = await this.prisma.catagorie.findUnique({
      where: {
        id: createAgePriceDto.categoryId,
      },
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }
    await this.checkOverlap(
      createAgePriceDto.categoryId,
      createAgePriceDto.priceType,
      createAgePriceDto.minDays,
      createAgePriceDto.maxDays,
    );

    const result = await this.prisma.agePriceRule.create({
      data: {
        categoryId: createAgePriceDto.categoryId,
        priceType: createAgePriceDto.priceType,
        minDays: createAgePriceDto.minDays,
        maxDays: createAgePriceDto.maxDays ?? null,
        price: createAgePriceDto.price,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    return result;
  }

  async findAllAgePrice(categoryId?: string, priceType?: PriceType) {
    return this.prisma.agePriceRule.findMany({
      where: {
        ...(categoryId ? { categoryId } : {}),
        ...(priceType ? { priceType } : {}),
      },
      orderBy: [{ priceType: 'asc' }, { minDays: 'asc' }],
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.agePriceRule.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });
    if (!rule) {
      throw new NotFoundException(`Age price rule with ID ${id} not found`);
    }
    return rule;
  }

  async update(id: string, dto: UpdateAgePriceDto) {
    const existingRule = await this.findOne(id);
    const categoryId = dto.categoryId ?? existingRule.categoryId;
    const priceType = dto.priceType ?? existingRule.priceType;
    const minDays = dto.minDays ?? existingRule.minDays;
    const maxDays =
      dto.maxDays !== undefined ? dto.maxDays : existingRule.maxDays;
    await this.checkOverlap(categoryId, priceType, minDays, maxDays, id);
    return this.prisma.agePriceRule.update({
      where: { id },
      data: {
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.priceType ? { priceType: dto.priceType } : {}),
        ...(dto.minDays !== undefined ? { minDays: dto.minDays } : {}),
        ...(dto.maxDays !== undefined ? { maxDays: dto.maxDays } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.agePriceRule.delete({ where: { id } });
    return { message: 'Age price rule deleted successfully' };
  }

  async getMatchingPrice(
    categoryId: string,
    priceType: PriceType,
    ageInDays: number,
  ): Promise<number | null> {
    const matchingRule = await this.prisma.agePriceRule.findFirst({
      where: {
        categoryId,
        priceType,
        minDays: { lte: ageInDays },
        OR: [{ maxDays: { gte: ageInDays } }, { maxDays: null }],
      },
    });
    return matchingRule ? matchingRule.price.toNumber() : null;
  }
}

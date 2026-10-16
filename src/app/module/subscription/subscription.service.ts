import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import buildWhereConditions from '../../helper/buildWhereConditions';
import paginationHelper, { IOptions } from '../../helper/pagenation';
import { IFilterParams } from '../../helper/pick';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkAdmin(adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || !['admin', 'superadmin'].includes(admin.role)) {
      throw new ForbiddenException('Only admins can manage subscription plans');
    }
  }

  async createSubscribe(adminId: string, dto: CreateSubscriptionDto) {
    await this.checkAdmin(adminId);
    return this.prisma.subscribe.create({
      data: {
        title: dto.title,
        subTitle: dto.subTitle,
        price: dto.price,
        discount: dto.discount,
        createdById: adminId,
      },
    });
  }

  async getAllSubscribes(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);
    const whenCondition = buildWhereConditions(params, [
      'title',
      'subTitle',
      'currency',
    ]);
    const [result, total] = await Promise.all([
      this.prisma.subscribe.findMany({
        where: whenCondition,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.subscribe.count({
        where: whenCondition,
      }),
    ]);

    return {
      data: result,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  getActivePlans() {
    return this.prisma.subscribe.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
      take: 100,
      select: {
        id: true,
        title: true,
        subTitle: true,
        price: true,
        discount: true,
        currency: true,
      },
    });
  }

  async singleSubscribe(id: string) {
    const result = await this.prisma.subscribe.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException('Subscription plan not found');
    }
    return result;
  }

  async updateSubscribe(
    adminId: string,
    id: string,
    dto: UpdateSubscriptionDto,
  ) {
    await this.checkAdmin(adminId);
    // Explicit fields prevent clients from changing createdById / updatedById.
    return this.prisma.subscribe.update({
      where: { id },
      data: {
        title: dto.title,
        subTitle: dto.subTitle,
        price: dto.price,
        discount: dto.discount,
        isActive: dto.isActive,
        updatedById: adminId,
      },
    });
  }

  async deleteSubscribe(adminId: string, id: string) {
    await this.checkAdmin(adminId);
    const exist = await this.prisma.subscribe.findUnique({
      where: { id },
    });
    if (!exist) {
      throw new NotFoundException('Subscription plan not found');
    }
    const result = await this.prisma.subscribe.delete({
      where: { id },
    });
    return result;
  }
}

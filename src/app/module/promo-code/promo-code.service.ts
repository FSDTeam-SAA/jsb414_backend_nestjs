import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import buildWhereConditions from '../../helper/buildWhereConditions';
import paginationHelper, { IOptions } from '../../helper/pagenation';
import { IFilterParams } from '../../helper/pick';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { ValidatePromoCodeDto } from './dto/validate-promo-code.dto';

@Injectable()
export class PromoCodeService {
  constructor(private readonly prisma: PrismaService) {}

  // ১. নতুন প্রোমো কোড তৈরি (Figma: "New Promo Code" Modal)
  async createPromoCode(dto: CreatePromoCodeDto) {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.prisma.promoCode.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException(`Promo code "${code}" already exists`);
    }

    const promo = await this.prisma.promoCode.create({
      data: {
        code, // Code Name (e.g. WELCOME)
        discount: Math.round(Number(dto.discount)), // Code Discount (e.g. $5)
        claimedUser: Number(dto.claimedUser), // Claimed User (e.g. 150)
        isActive: dto.isActive !== undefined ? dto.isActive : true, // Activity toggle
      },
    });

    return {
      message: `Promo code "${promo.code}" created successfully`,
      data: this.formatPromo(promo),
    };
  }

  // ২. সকল প্রোমো কোডের তালিকা (Figma: "Promo Code" Table)
  async getAllPromoCodes(params: IFilterParams, options: IOptions) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper(options);
    const whenCondition = buildWhereConditions(params, ['code']);

    const [promos, total] = await Promise.all([
      this.prisma.promoCode.findMany({
        where: whenCondition,
        skip,
        take: limit,
        orderBy: {
          [sortBy || 'createdAt']: sortOrder || 'desc',
        },
        include: {
          _count: {
            select: {
              usages: true,
              orders: true,
            },
          },
        },
      }),
      this.prisma.promoCode.count({
        where: whenCondition,
      }),
    ]);

    return {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: promos.map((p) => this.formatPromo(p)),
    };
  }

  // ৩. একক প্রোমো কোডের বিস্তারিত
  async getSinglePromoCode(id: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
      include: {
        usages: {
          take: 20,
          orderBy: { usedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
                totalAmount: true,
              },
            },
          },
        },
      },
    });

    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }

    return {
      ...this.formatPromo(promo),
      recentUsages: promo.usages.map((u) => ({
        id: u.id,
        user: u.user,
        orderNumber: u.order?.orderNumber,
        discountAmount: Number(u.discountAmount),
        usedAt: u.usedAt,
      })),
    };
  }

  // ৪. প্রোমো কোড আপডেট
  async updatePromoCode(id: string, dto: UpdatePromoCodeDto) {
    const existing = await this.prisma.promoCode.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Promo code not found');
    }

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      if (code !== existing.code) {
        const duplicate = await this.prisma.promoCode.findUnique({
          where: { code },
        });
        if (duplicate) {
          throw new ConflictException(`Promo code "${code}" already exists`);
        }
      }
    }

    const updated = await this.prisma.promoCode.update({
      where: { id },
      data: {
        ...(dto.code && { code: dto.code.trim().toUpperCase() }),
        ...(dto.discount !== undefined && {
          discount: Math.round(Number(dto.discount)),
        }),
        ...(dto.claimedUser !== undefined && {
          claimedUser: Number(dto.claimedUser),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return {
      message: 'Promo code updated successfully',
      data: this.formatPromo(updated),
    };
  }

  // ৫. প্রোমো কোড অন/অফ সুইচ (Figma: Activity Toggle Switch)
  async togglePromoCodeStatus(id: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
    });
    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }

    const newStatus = !promo.isActive;
    const updated = await this.prisma.promoCode.update({
      where: { id },
      data: { isActive: newStatus },
    });

    return {
      message: newStatus
        ? `Promo code "${updated.code}" is now ON (Active)`
        : `Promo code "${updated.code}" is now OFF (Inactive)`,
      data: this.formatPromo(updated),
    };
  }

  // ৬. প্রোমো কোড ডিলিট (Figma: Action Delete Icon)
  async deletePromoCode(id: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
      include: { _count: { select: { usages: true } } },
    });
    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }

    if (promo._count.usages > 0) {
      // যদি আগে অর্ডার হয়ে থাকে, অডিট রেকর্ডের সুরক্ষায় এটি অফ করা হয়
      await this.prisma.promoCode.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        message:
          'Promo code has existing order history; it has been turned OFF instead of deleted.',
      };
    }

    await this.prisma.promoCode.delete({
      where: { id },
    });

    return {
      message: `Promo code "${promo.code}" deleted successfully`,
    };
  }

  // ৭. ইউজার চেকআউটে প্রোমো কোড ভ্যালিডেশন প্রিভিউ (Figma: Apply Promo Code)
  async validatePromoCode(
    userId: string | undefined,
    dto: ValidatePromoCodeDto,
  ) {
    const code = dto.code.trim().toUpperCase();
    const promo = await this.prisma.promoCode.findUnique({
      where: { code },
    });

    if (!promo) {
      throw new BadRequestException('Invalid promo code');
    }

    // ১. Activity সুইচ অন/অফ চেক
    if (!promo.isActive) {
      throw new BadRequestException('This promo code is currently inactive');
    }

    // ২. Claimed User সীমা চেক
    if (promo.usedCount >= promo.claimedUser) {
      throw new BadRequestException(
        `This promo code has reached its maximum claimed limit of ${promo.claimedUser}`,
      );
    }

    // ৩. ডলার ডিসকাউন্ট হিসাব (Figma: Code Discount, e.g. $5, $20)
    const discountVal = Number(promo.discount);
    const subtotal = dto.subtotal !== undefined ? Number(dto.subtotal) : null;
    const discountAmount =
      subtotal !== null ? Math.min(discountVal, subtotal) : discountVal;
    const finalAmount =
      subtotal !== null
        ? Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100)
        : null;

    return {
      valid: true,
      promoCodeId: promo.id,
      code: promo.code,
      discount: discountVal,
      discountAmount,
      subtotal,
      finalAmount,
      message: `Promo code applied: $${discountVal} discount`,
    };
  }

  // ৮. অর্ডারের ট্রানজেকশনে ক্লেইম রেকর্ড করা
  async recordUsage(
    tx: any,
    promoCodeId: string,
    userId: string,
    orderId: string,
    discountAmount: number,
  ) {
    await tx.promoCode.update({
      where: { id: promoCodeId },
      data: {
        usedCount: { increment: 1 },
      },
    });

    await tx.promoCodeUsage.create({
      data: {
        promoCodeId,
        userId,
        orderId,
        discountAmount,
      },
    });
  }

  // হেল্পার: ফিগমার টেবিল কলামের সাথে ১০০% মিল রেখে ডাটা ফরম্যাট
  private formatPromo(p: any) {
    const d = new Date(p.createdAt);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    const createDate = `${mm}/${dd}/${yyyy}`; // Figma: "10/13/2026"

    return {
      id: p.id,
      code: p.code, // Figma Column: "Promo Code"
      createDate, // Figma Column: "Create date"
      discount: p.discount, // Number
      discountAmount: `$${p.discount}`, // Figma Column: "Discount Amount" ($5, $20)
      claimed: p.claimedUser, // Figma Column: "Claimed"
      claimedUser: p.claimedUser, // Figma Modal: "Claimed User"
      usedCount: p.usedCount, // How many times claimed
      activity: p.isActive, // Figma Column: "Activity" (Toggle Switch)
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminAdjustWalletDto } from './dto/admin-adjust-wallet.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        walletBalanceCents: true,
      },
    });
    if (!user) {
      throw new Error('User not found');
    }
    const balanceCebt = user.walletBalanceCents ?? 0;
    return {
      walletBalanceCents: balanceCebt,
      formattedBalance: `$${(balanceCebt / 100).toFixed(2)}`,
    };
  }

  async addFound(userId: string, dto: CreateWalletDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          walletBalanceCents: { increment: dto.amountCents },
        },
        select: { walletBalanceCents: true },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          userId,
          amountCents: dto.amountCents,
          balanceAfter: updatedUser.walletBalanceCents,
          type: 'TOP_UP',
          description: `Added funds: $${(dto.amountCents / 100).toFixed(2)}`,
        },
      });
      // পেমেন্ট হিস্ট্রি রেকর্ড
      await tx.payment.create({
        data: {
          userId,
          amount: dto.amountCents / 100,
          currency: 'USD',
          paymentType: 'ACCOUNT_FUNDING',
          status: 'COMPLETED',
        },
      });
      return {
        transactionId: transaction.id,
        amountAddedCents: dto.amountCents,
        newBalanceCents: updatedUser.walletBalanceCents,
        formattedBalance: `$${(updatedUser.walletBalanceCents / 100).toFixed(2)}`,
      };
    });

    return result;
  }

  async getTransactions(userId: string, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);

    const [result, total] = await Promise.all([
      await this.prisma.walletTransaction.findMany({
        where: {
          userId: userId,
        },
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),

      this.prisma.walletTransaction.count({
        where: {
          userId: userId,
        },
      }),
    ]);

    return {
      data: result,
      meta: { total, page, limit },
    };
  }

  async adminAdjustBalance(dto: AdminAdjustWalletDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: {
          id: dto.userId,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (
        dto.amountCents < 0 &&
        (user.walletBalanceCents ?? 0) < Math.abs(dto.amountCents)
      ) {
        throw new BadRequestException(
          'User does not have sufficient balance to deduct',
        );
      }

      const updateUser = await tx.user.update({
        where: { id: dto.userId },
        data: {
          walletBalanceCents: { increment: dto.amountCents },
        },
        select: { walletBalanceCents: true },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          userId: dto.userId,
          amountCents: dto.amountCents,
          balanceAfter: updateUser.walletBalanceCents,
          type: 'ADMIN_ADJUSTMENT',
          description: dto.reason,
        },
      });

      return {
        transactionId: transaction.id,
        amountAdjustedCents: dto.amountCents,
        newBalanceCents: updateUser.walletBalanceCents,
        formattedBalance: `$${(updateUser.walletBalanceCents / 100).toFixed(2)}`,
      };
    });

    return result;
  }
}

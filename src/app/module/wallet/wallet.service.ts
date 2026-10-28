import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../../prisma/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import config from '../../config';
import { IOptions } from '../../helper/pagenation';
import { displayUsd, stripeCents, usd } from '../../helper/usd';
import { AdminAdjustWalletDto } from './dto/admin-adjust-wallet.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  private getStripe() {
    if (!config.stripe.secretKey) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
    return new Stripe(config.stripe.secretKey);
  }

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      walletBalance: user.walletBalance.toNumber(),
      currency: 'USD',
      formattedBalance: displayUsd(user.walletBalance),
      balanceType: 'ACCOUNT_CREDIT',
    };
  }

  // This creates a payment link, never account credit. Only the webhook credits it.
  async addFunds(userId: string, dto: CreateWalletDto) {
    const amount = usd(dto.amount);
    if (amount.lt(1)) throw new BadRequestException('Minimum funding is $1');
    const stripe = this.getStripe();
    const requestId = dto.requestId ?? randomUUID();
    const fundingRequestKey = `wallet:${userId}:${requestId}`;
    const payment = await this.prisma.payment.upsert({
      where: { fundingRequestKey },
      update: {},
      create: {
        userId,
        amount,
        currency: 'USD',
        paymentType: 'ACCOUNT_FUNDING',
        status: 'PENDING',
        fundingRequestKey,
      },
    });
    if (!payment.amount.equals(amount)) {
      throw new ConflictException('Use a new requestId for a different amount');
    }
    if (payment.status === 'COMPLETED') {
      return {
        requestId,
        paymentId: payment.id,
        status: payment.status,
        amount: amount.toNumber(),
        currency: 'USD',
        checkoutUrl: null,
      };
    }
    if (payment.status !== 'PENDING') {
      throw new ConflictException('Create a new funding request');
    }
    // Stripe idempotency keys may be pruned after 24 hours. Do not recreate
    // an uncertain checkout after that window and risk charging twice.
    if (
      !payment.stripeSessionId &&
      Date.now() - payment.createdAt.getTime() > 23 * 60 * 60 * 1000
    ) {
      throw new ConflictException(
        'This funding request needs payment reconciliation before retrying',
      );
    }

    const frontendUrl = config.frontendUrl.replace(/\/$/, '');
    let session: Stripe.Checkout.Session;
    try {
      session = payment.stripeSessionId
        ? await stripe.checkout.sessions.retrieve(payment.stripeSessionId)
        : await stripe.checkout.sessions.create(
            {
              mode: 'payment',
              allowed_payment_method_types: ['card'],
              client_reference_id: userId,
              metadata: { purpose: 'WALLET_FUNDING', paymentId: payment.id },
              line_items: [
                {
                  price_data: {
                    currency: 'usd',
                    unit_amount: stripeCents(amount),
                    product_data: { name: 'Foreclosure Gold Account Credit' },
                  },
                  quantity: 1,
                },
              ],
              success_url: `${frontendUrl}/wallet?funding=success`,
              cancel_url: `${frontendUrl}/wallet?funding=cancelled`,
            },
            { idempotencyKey: `wallet-funding-${payment.id}` },
          );
    } catch {
      // A timeout does not prove payment creation failed. Keep PENDING for retry.
      throw new ServiceUnavailableException(
        'Payment provider unavailable; retry with the same requestId',
      );
    }
    if (session.status === 'expired') {
      throw new ConflictException('Checkout expired; use a new requestId');
    }
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { stripeSessionId: session.id },
    });
    if (!session.url && session.status !== 'complete') {
      throw new ServiceUnavailableException('Payment link is unavailable');
    }
    return {
      requestId,
      paymentId: payment.id,
      status: 'PENDING',
      amount: amount.toNumber(),
      currency: 'USD',
      checkoutUrl: session.url,
    };
  }

  async getTransactions(userId: string, options: IOptions) {
    const page = Number(options.page ?? 1);
    const limit = Number(options.limit ?? 25);
    const sortBy = options.sortBy ?? 'createdAt';
    const sortOrder = options.sortOrder ?? 'desc';
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 1000000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !['createdAt', 'amount', 'balanceAfter'].includes(sortBy) ||
      !['asc', 'desc'].includes(sortOrder)
    ) {
      throw new BadRequestException('Invalid pagination or sorting');
    }
    const [entries, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where: { userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          amount: true,
          balanceAfter: true,
          type: true,
          description: true,
          referenceId: true,
          createdAt: true,
        },
      }),
      this.prisma.walletTransaction.count({ where: { userId } }),
    ]);
    return {
      data: entries.map((entry) => ({
        ...entry,
        amount: entry.amount.toNumber(),
        balanceAfter: entry.balanceAfter.toNumber(),
        currency: 'USD',
      })),
      meta: { total, page, limit },
    };
  }

  // Separate manual business credit; never masquerades as a successful card payment.
  async adminAdjustBalance(actorId: string, dto: AdminAdjustWalletDto) {
    const amount = usd(dto.amount);
    if (amount.isZero() || !dto.reason.trim()) {
      throw new BadRequestException(
        'A non-zero amount and reason are required',
      );
    }
    const operationKey = `admin:${actorId}:${dto.requestId}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.walletTransaction.findUnique({
              where: { operationKey },
            });
            if (previous) {
              if (
                previous.userId !== dto.userId ||
                !previous.amount.equals(amount) ||
                previous.description !== dto.reason.trim()
              ) {
                throw new ConflictException(
                  'requestId was already used for another adjustment',
                );
              }
              return this.adjustmentResponse(previous);
            }
            const user = await tx.user.findUnique({
              where: { id: dto.userId },
              select: { id: true },
            });
            if (!user) throw new NotFoundException('User not found');
            const changed = await tx.user.updateMany({
              where: {
                id: dto.userId,
                ...(amount.isNegative()
                  ? { walletBalance: { gte: amount.abs() } }
                  : {}),
              },
              data: { walletBalance: { increment: amount } },
            });
            if (changed.count !== 1)
              throw new BadRequestException('Insufficient account credit');
            const updated = await tx.user.findUniqueOrThrow({
              where: { id: dto.userId },
              select: { walletBalance: true },
            });
            const entry = await tx.walletTransaction.create({
              data: {
                userId: dto.userId,
                amount,
                balanceAfter: updated.walletBalance,
                type: 'ADMIN_ADJUSTMENT',
                description: dto.reason.trim(),
                operationKey,
                actorId,
              },
            });
            return this.adjustmentResponse(entry);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          !['P2034', 'P2002'].includes(error.code)
        )
          throw error;
        if (attempt === 2)
          throw new ConflictException(
            'Balance changed concurrently; retry with the same requestId',
          );
      }
    }
    throw new ConflictException('Please retry');
  }

  private adjustmentResponse(entry: {
    id: string;
    amount: Prisma.Decimal;
    balanceAfter: Prisma.Decimal;
  }) {
    return {
      transactionId: entry.id,
      amountAdjusted: entry.amount.toNumber(),
      newBalance: entry.balanceAfter.toNumber(),
      currency: 'USD',
      formattedBalance: displayUsd(entry.balanceAfter),
    };
  }
}

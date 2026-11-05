import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../../prisma/prisma.service';
import config from '../../config';
import { stripeCents } from '../../helper/usd';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationService?: NotificationService,
  ) {}

  private getStripe() {
    if (!config.stripe.secretKey) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    return new Stripe(config.stripe.secretKey);
  }

  // ১. Stripe-এর request যাচাই এবং event অনুযায়ী কাজ।
  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    const stripe = this.getStripe();

    if (!config.stripe.webhookSecret) {
      throw new ServiceUnavailableException('Stripe webhook is not configured');
    }

    let event: Stripe.Event;

    // শুধু signature verification-এর error এখানে ধরছি।
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        config.stripe.webhookSecret,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;

        await this.handleCheckoutSession(session);
        break;
      }

      default:
        break;
    }

    return {
      received: true,
    };
  }

  // ২. Checkout কোন কাজের জন্য তৈরি হয়েছিল?
  private async handleCheckoutSession(session: Stripe.Checkout.Session) {
    switch (session.metadata?.purpose) {
      case 'WALLET_FUNDING':
        await this.handleWalletFunding(session);
        break;

      case 'SUBSCRIPTION':
        await this.handleSubscriptionPayment(session);
        break;

      case 'ORDER_PURCHASE':
        await this.handleOrderPayment(session);
        break;

      default:
        break;
    }
  }

  // ৩. Wallet payment যাচাই।
  private async handleWalletFunding(session: Stripe.Checkout.Session) {
    if (session.mode !== 'payment' || session.payment_status !== 'paid') {
      return;
    }

    const paymentId = session.metadata?.paymentId;

    if (!paymentId) {
      throw new InternalServerErrorException(
        'Wallet payment reference is missing',
      );
    }

    const payment = await this.prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!payment) {
      throw new InternalServerErrorException('Wallet payment record not found');
    }

    const amountCents = stripeCents(payment.amount);

    const sessionDoesNotMatch =
      payment.stripeSessionId !== null &&
      payment.stripeSessionId !== session.id;

    if (
      payment.paymentType !== 'ACCOUNT_FUNDING' ||
      session.client_reference_id !== payment.userId ||
      payment.currency.toUpperCase() !== 'USD' ||
      session.currency !== 'usd' ||
      session.amount_total !== amountCents ||
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      sessionDoesNotMatch
    ) {
      throw new InternalServerErrorException(
        'Wallet payment verification failed',
      );
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    // ৪. Payment, balance ও history একসঙ্গে update।
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: 'PENDING',
          OR: [{ stripeSessionId: null }, { stripeSessionId: session.id }],
        },
        data: {
          status: 'COMPLETED',
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        },
      });

      if (claimed.count === 0) {
        return;
      }

      const user = await tx.user.update({
        where: {
          id: payment.userId,
        },
        data: {
          walletBalance: {
            increment: payment.amount,
          },
        },
        select: {
          walletBalance: true,
        },
      });

      await tx.walletTransaction.create({
        data: {
          userId: payment.userId,
          amount: payment.amount,
          balanceAfter: user.walletBalance,
          type: 'TOP_UP',
          referenceId: payment.id,
          operationKey: `funding:${payment.id}`,
          description: 'Prepaid account credit through Stripe',
        },
      });
    });

    try {
      if (this.notificationService) {
        await this.notificationService.createNotification({
          userId: payment.userId,
          title: 'Wallet Funded',
          message: `$${Number(payment.amount).toFixed(2)} was successfully added to your wallet.`,
          type: 'WALLET_TRANSACTION',
          link: '/dashboard/wallet',
        });
      }
    } catch (err: any) {
      console.error('Failed to notify user on wallet top-up:', err?.message || err);
    }
  }

  // ৪. Subscription payment যাচাই ও সক্রিয়করণ।
  private async handleSubscriptionPayment(session: Stripe.Checkout.Session) {
    if (session.mode !== 'payment' || session.payment_status !== 'paid') {
      return;
    }

    const paymentId = session.metadata?.paymentId;
    if (!paymentId) return;

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.status === 'COMPLETED') return;

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    const now = new Date();
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        },
      });

      const existingSubscription = await tx.userSubscribe.findFirst({
        where: { userId: payment.userId },
      });

      if (existingSubscription) {
        await tx.userSubscribe.update({
          where: { id: existingSubscription.id },
          data: {
            subscribeId: payment.subscribeId!,
            status: 'ACTIVE',
            startDate: now,
            endDate,
          },
        });
      } else {
        await tx.userSubscribe.create({
          data: {
            userId: payment.userId,
            subscribeId: payment.subscribeId!,
            status: 'ACTIVE',
            startDate: now,
            endDate,
          },
        });
      }
    });
  }

  // ৫. Order (Lead Purchase) payment যাচাই ও প্রসেসিং
  private async handleOrderPayment(session: Stripe.Checkout.Session) {
    if (session.mode !== 'payment' || session.payment_status !== 'paid') {
      return;
    }

    const orderId = session.metadata?.orderId;
    if (!orderId) {
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
      },
    });

    if (!order || order.status === 'COMPLETED') {
      return;
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    await this.prisma.$transaction(async (tx) => {
      // ডুপ্লিকেট রোধে শুধুমাত্র PENDING অর্ডার আপডেট
      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'PENDING',
        },
        data: {
          status: 'COMPLETED',
          stripePaymentId: paymentIntentId || session.id,
        },
      });

      if (claimed.count === 0) {
        return;
      }

      // যদি ওয়ালেট দিয়ে আংশিক পেমেন্ট থাকে, তবে ওয়ালেট ব্যালেন্স কাটা হবে
      const walletUsed = Number(order.walletUsed || 0);
      if (walletUsed > 0) {
        const user = await tx.user.update({
          where: { id: order.userId },
          data: {
            walletBalance: {
              decrement: walletUsed,
            },
          },
          select: {
            walletBalance: true,
          },
        });

        await tx.walletTransaction.create({
          data: {
            userId: order.userId,
            amount: walletUsed,
            balanceAfter: user.walletBalance,
            type: 'PURCHASE',
            referenceId: order.id,
            operationKey: `order:${order.id}`,
            description: `Lead purchase Order #${order.orderNumber}`,
          },
        });
      }

      // অর্ডার করা প্রতিটা লিড ইউজারের একাউন্টে যুক্ত করা এবং ইনভেন্টরি আপডেট
      for (const item of order.orderItems) {
        await tx.userLead.upsert({
          where: {
            userId_leadId: {
              userId: order.userId,
              leadId: item.leadId,
            },
          },
          create: {
            userId: order.userId,
            leadId: item.leadId,
            priceType: item.priceType,
            pricePaid: item.pricePaid,
            orderId: order.id,
          },
          update: {},
        });

        if (item.priceType === 'EXCLUSIVE') {
          await tx.lead.update({
            where: { id: item.leadId },
            data: { exclusiveSoldAt: new Date() },
          });
        } else {
          await tx.lead.update({
            where: { id: item.leadId },
            data: { sharedSalesCount: { increment: 1 } },
          });
        }
      }

      // যদি অর্ডারে প্রোমো কোড ব্যবহার করা হয়ে থাকে
      if (order.promoCodeId && Number(order.promoDiscount || 0) > 0) {
        await tx.promoCode.update({
          where: { id: order.promoCodeId },
          data: {
            usedCount: { increment: 1 },
          },
        });

        await tx.promoCodeUsage.create({
          data: {
            promoCodeId: order.promoCodeId,
            userId: order.userId,
            orderId: order.id,
            discountAmount: order.promoDiscount,
          },
        });
      }

      // কার্ট থেকে কেনা আইটেমগুলো মুছে ফেলা
      const purchasedLeadIds = order.orderItems.map((oi) => oi.leadId);
      await tx.cartItem.deleteMany({
        where: {
          userId: order.userId,
          leadId: { in: purchasedLeadIds },
        },
      });
    });

    try {
      if (this.notificationService) {
        await this.notificationService.createNotification({
          userId: order.userId,
          title: 'Order Confirmed',
          message: `Your order #${order.orderNumber} for ${order.orderItems.length} lead(s) was confirmed. Total: $${Number(order.totalAmount).toFixed(2)}.`,
          type: 'ORDER',
          link: '/dashboard/my-leads',
        });

        await this.notificationService.notifyAdmins({
          title: 'New Order Received (Card)',
          message: `Order #${order.orderNumber} ($${Number(order.totalAmount).toFixed(2)}) paid successfully via Stripe card.`,
          type: 'ORDER',
          link: '/admin/orders',
        });
      }
    } catch (err: any) {
      console.error('Failed to notify order completion via stripe:', err?.message || err);
    }
  }
}

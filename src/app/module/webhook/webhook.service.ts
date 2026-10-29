import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../../prisma/prisma.service';
import config from '../../config';
import { stripeCents } from '../../helper/usd';

@Injectable()
export class WebhookService {
  constructor(private readonly prisma: PrismaService) {}

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
}

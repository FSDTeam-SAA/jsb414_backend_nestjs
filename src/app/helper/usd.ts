import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/prisma/client';

// Application/database amounts are USD. Only Stripe receives integer cents.
export function usd(amount: number): Prisma.Decimal {
  if (!Number.isFinite(amount) || Math.abs(amount) > 10000) {
    throw new BadRequestException(
      'Amount must be between -10000 and 10000 USD',
    );
  }
  const value = new Prisma.Decimal(amount.toString());
  if (value.decimalPlaces() > 2) {
    throw new BadRequestException('Amount may have at most 2 decimal places');
  }
  return value;
}

export function stripeCents(amount: Prisma.Decimal): number {
  const cents = amount.mul(100);
  if (!cents.isInteger() || !Number.isSafeInteger(cents.toNumber())) {
    throw new BadRequestException('Invalid USD amount');
  }
  return cents.toNumber();
}

export function displayUsd(amount: Prisma.Decimal) {
  return `$${amount.toFixed(2)}`;
}

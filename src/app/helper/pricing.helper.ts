import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/prisma/client';

type DollarValue = number | string | Prisma.Decimal;

export interface IPriceCalculationParams {
  categorySharedBasePrice: DollarValue | null;
  categoryExclusiveBasePrice: DollarValue | null;
  agePricingEnabled: boolean;
  ageInDays: number;
  agePriceRules?: Array<{
    priceType: 'SHARED' | 'EXCLUSIVE';
    price: DollarValue;
    minDays: number;
    maxDays?: number | null;
  }>;
  userDiscountPercent?: number;
}

// One rule for every screen: category dollars -> optional age dollars -> membership %.
// Per-lead copied prices are deliberately not read.
export function calculateDynamicLeadPrice(params: IPriceCalculationParams) {
  const discountPercent = params.userDiscountPercent ?? 0;
  if (
    !Number.isInteger(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 100
  ) {
    throw new ConflictException('Membership discount is invalid');
  }

  const calculate = (
    type: 'SHARED' | 'EXCLUSIVE',
    base: DollarValue | null,
  ) => {
    let selected = base;
    if (params.agePricingEnabled) {
      const matches = (params.agePriceRules ?? []).filter(
        (rule) =>
          rule.priceType === type &&
          rule.minDays <= params.ageInDays &&
          (rule.maxDays === null ||
            rule.maxDays === undefined ||
            rule.maxDays >= params.ageInDays),
      );
      if (matches.length > 1)
        throw new ConflictException(
          'Overlapping age-price rules need correction',
        );
      if (matches.length === 1) selected = matches[0].price;
    }
    if (selected === null)
      return { original: null, final: null, discount: new Prisma.Decimal(0) };
    const original = new Prisma.Decimal(selected);
    if (
      !original.isFinite() ||
      original.isNegative() ||
      original.decimalPlaces() > 2
    ) {
      throw new ConflictException('Price is not configured correctly');
    }
    const discount = original
      .mul(discountPercent)
      .div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return { original, discount, final: original.minus(discount) };
  };

  const shared = calculate('SHARED', params.categorySharedBasePrice);
  const exclusive = calculate('EXCLUSIVE', params.categoryExclusiveBasePrice);
  return {
    originalShared: shared.original,
    finalShared: shared.final,
    sharedDiscount: shared.discount,
    originalExclusive: exclusive.original,
    finalExclusive: exclusive.final,
    exclusiveDiscount: exclusive.discount,
    appliedDiscountPercent: discountPercent,
  };
}

export function inventoryAge(createdAt: Date, now = new Date()) {
  return Math.max(
    0,
    Math.floor((now.getTime() - createdAt.getTime()) / 86400000),
  );
}

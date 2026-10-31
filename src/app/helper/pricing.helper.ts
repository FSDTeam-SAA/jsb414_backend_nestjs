import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/prisma/client';

type DollarValue = number | string | Prisma.Decimal;

export interface IPriceCalculationParams {
  categorySharedBasePrice: DollarValue | null;
  categoryExclusiveBasePrice: DollarValue | null;
  agePricingEnabled: boolean;
  ageInDays: number;
  agePriceRules?: Array<{
    minDays: number;
    maxDays?: number | null;
    discountPercent?: number | null;
    priceType?: 'SHARED' | 'EXCLUSIVE' | null;
    price?: DollarValue | null;
  }>;
  userDiscountPercent?: number;
}

// বয়সভিত্তিক ডিসকাউন্ট (%) ও মেম্বারশিপ ডিসকাউন্ট (%) ক্রমান্বয়ে হিসাব করার কেন্দ্রীয় হেল্পার
export function calculateDynamicLeadPrice(params: IPriceCalculationParams) {
  const membershipDiscountPercent = params.userDiscountPercent ?? 0;
  if (
    !Number.isInteger(membershipDiscountPercent) ||
    membershipDiscountPercent < 0 ||
    membershipDiscountPercent > 100
  ) {
    throw new ConflictException('Membership discount is invalid');
  }

  // ১. বয়সভিত্তিক ছাড় নির্ধারণ (যদি ক্যাটাগরিতে agePricingEnabled = true থাকে)
  let ageDiscountPercent = 0;
  if (
    params.agePricingEnabled &&
    params.agePriceRules &&
    params.agePriceRules.length > 0
  ) {
    const matchingRule = params.agePriceRules.find(
      (rule) =>
        rule.minDays <= params.ageInDays &&
        (rule.maxDays === null ||
          rule.maxDays === undefined ||
          rule.maxDays >= params.ageInDays),
    );
    if (matchingRule && typeof matchingRule.discountPercent === 'number') {
      ageDiscountPercent = matchingRule.discountPercent;
    }
  }

  const calculate = (
    type: 'SHARED' | 'EXCLUSIVE',
    base: DollarValue | null,
  ) => {
    if (base === null || base === undefined) {
      return {
        original: null,
        final: null,
        discount: new Prisma.Decimal(0),
        afterAgePrice: null,
      };
    }

    const original = new Prisma.Decimal(base);
    if (
      !original.isFinite() ||
      original.isNegative() ||
      original.decimalPlaces() > 2
    ) {
      throw new ConflictException('Base price is not configured correctly');
    }

    // ক. বয়সভিত্তিক ডিসকাউন্ট প্রয়োগ (যদি ক্যাটাগরিতে ট্রু থাকে এবং ছাড় থাকে)
    let priceAfterAge = original;
    if (ageDiscountPercent > 0) {
      const ageCut = original
        .mul(ageDiscountPercent)
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      priceAfterAge = original.minus(ageCut);
    }

    // খ. মেম্বারশিপ ডিসকাউন্ট প্রয়োগ (বয়সের পরের দামের ওপর)
    let final = priceAfterAge;
    if (membershipDiscountPercent > 0) {
      const memberCut = priceAfterAge
        .mul(membershipDiscountPercent)
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      final = priceAfterAge.minus(memberCut);
    }

    const totalDiscount = original.minus(final);

    return {
      original,
      afterAgePrice: priceAfterAge,
      discount: totalDiscount,
      final,
    };
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
    appliedAgeDiscountPercent: ageDiscountPercent,
    appliedDiscountPercent: membershipDiscountPercent,
  };
}

export function inventoryAge(createdAt: Date, now = new Date()) {
  return Math.max(
    0,
    Math.floor((now.getTime() - createdAt.getTime()) / 86400000),
  );
}

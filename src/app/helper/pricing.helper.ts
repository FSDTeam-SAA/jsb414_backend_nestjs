export interface IPriceCalculationParams {
  leadSharedPriceCents?: number | null;
  leadExclusivePriceCents?: number | null;
  categorySharedBasePriceCents: number;
  categoryExclusiveBasePriceCents: number;
  agePricingEnabled: boolean;
  ageInDays: number;
  agePriceRules?: Array<{
    priceType: 'SHARED' | 'EXCLUSIVE';
    priceCents: number;
    minDays: number;
    maxDays?: number | null;
  }>;
  userDiscountPercent?: number; // কাস্টমারের মেম্বারশিপ টায়ার ডিসকাউন্ট (যেমন: 10, 20)
}

export const calculateDynamicLeadPrice = (params: IPriceCalculationParams) => {
  const {
    leadSharedPriceCents,
    leadExclusivePriceCents,
    categorySharedBasePriceCents,
    categoryExclusiveBasePriceCents,
    agePricingEnabled,
    ageInDays,
    agePriceRules = [],
    userDiscountPercent = 0,
  } = params;

  // ১. SHARED প্রাইস বের করা
  let sharedBase = categorySharedBasePriceCents;
  if (agePricingEnabled) {
    const matchedAgeRule = agePriceRules.find(
      (r) =>
        r.priceType === 'SHARED' &&
        r.minDays <= ageInDays &&
        (r.maxDays === null ||
          r.maxDays === undefined ||
          r.maxDays >= ageInDays),
    );
    if (matchedAgeRule) sharedBase = matchedAgeRule.priceCents;
  }
  // লিডের কাস্টম প্রাইস ওভাররাইড (যদি 0 বা নির্দিষ্ট সংখ্যা থাকে)
  if (leadSharedPriceCents !== null && leadSharedPriceCents !== undefined) {
    sharedBase = leadSharedPriceCents;
  }

  // ২. EXCLUSIVE প্রাইস বের করা
  let exclusiveBase = categoryExclusiveBasePriceCents;
  if (agePricingEnabled) {
    const matchedAgeRule = agePriceRules.find(
      (r) =>
        r.priceType === 'EXCLUSIVE' &&
        r.minDays <= ageInDays &&
        (r.maxDays === null ||
          r.maxDays === undefined ||
          r.maxDays >= ageInDays),
    );
    if (matchedAgeRule) exclusiveBase = matchedAgeRule.priceCents;
  }
  if (
    leadExclusivePriceCents !== null &&
    leadExclusivePriceCents !== undefined
  ) {
    exclusiveBase = leadExclusivePriceCents;
  }

  // ৩. মেম্বারশিপ ডিসকাউন্ট কর্তন
  const sharedDiscountCents = Math.round(
    (sharedBase * userDiscountPercent) / 100,
  );
  const exclusiveDiscountCents = Math.round(
    (exclusiveBase * userDiscountPercent) / 100,
  );

  return {
    originalSharedCents: sharedBase,
    finalSharedCents: Math.max(0, sharedBase - sharedDiscountCents),
    originalExclusiveCents: exclusiveBase,
    finalExclusiveCents: Math.max(0, exclusiveBase - exclusiveDiscountCents),
    appliedDiscountPercent: userDiscountPercent,
  };
};

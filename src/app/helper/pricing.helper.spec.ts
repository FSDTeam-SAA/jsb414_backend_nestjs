import { calculateDynamicLeadPrice } from './pricing.helper';

describe('calculateDynamicLeadPrice - Percentage Age Pricing & Membership', () => {
  const sampleAgeRules = [
    { minDays: 0, maxDays: 7, discountPercent: 0 },
    { minDays: 8, maxDays: 30, discountPercent: 15 },
    { minDays: 31, maxDays: 90, discountPercent: 30 },
    { minDays: 91, maxDays: null, discountPercent: 50 },
  ];

  it('calculates 15% age discount followed by 10% membership discount correctly', () => {
    // 15 days old lead (falls into 8-30 days -> 15% age discount)
    // User has Gold membership (10% discount)
    const result = calculateDynamicLeadPrice({
      categorySharedBasePrice: 20,
      categoryExclusiveBasePrice: 50,
      agePricingEnabled: true,
      ageInDays: 15,
      agePriceRules: sampleAgeRules,
      userDiscountPercent: 10,
    });

    // Base: $20
    // After 15% age cut: $20 - $3 = $17.00
    // After 10% member cut: $17 - $1.70 = $15.30
    expect(result.originalShared?.toString()).toBe('20');
    expect(result.finalShared?.toString()).toBe('15.3');
    expect(result.appliedAgeDiscountPercent).toBe(15);
    expect(result.appliedDiscountPercent).toBe(10);

    // Exclusive Base: $50
    // After 15% age cut: $50 - $7.50 = $42.50
    // After 10% member cut: $42.50 - $4.25 = $38.25
    expect(result.originalExclusive?.toString()).toBe('50');
    expect(result.finalExclusive?.toString()).toBe('38.25');
  });

  it('ignores age pricing when agePricingEnabled is false', () => {
    const result = calculateDynamicLeadPrice({
      categorySharedBasePrice: 20,
      categoryExclusiveBasePrice: 50,
      agePricingEnabled: false,
      ageInDays: 45, // 45 days old, but age pricing is OFF for this category
      agePriceRules: sampleAgeRules,
      userDiscountPercent: 10,
    });

    // Only 10% membership discount applies on base price
    // Shared: $20 - $2 = $18.00
    expect(result.originalShared?.toString()).toBe('20');
    expect(result.finalShared?.toString()).toBe('18');
    expect(result.appliedAgeDiscountPercent).toBe(0);

    // Exclusive: $50 - $5 = $45.00
    expect(result.finalExclusive?.toString()).toBe('45');
  });

  it('applies 0% age discount for new leads (0-7 days)', () => {
    const result = calculateDynamicLeadPrice({
      categorySharedBasePrice: 20,
      categoryExclusiveBasePrice: 50,
      agePricingEnabled: true,
      ageInDays: 3, // 3 days old
      agePriceRules: sampleAgeRules,
      userDiscountPercent: 0, // Free user
    });

    // No age discount, no member discount -> full price
    expect(result.finalShared?.toString()).toBe('20');
    expect(result.finalExclusive?.toString()).toBe('50');
    expect(result.appliedAgeDiscountPercent).toBe(0);
  });

  it('applies 50% age discount for leads older than 90 days', () => {
    const result = calculateDynamicLeadPrice({
      categorySharedBasePrice: 20,
      categoryExclusiveBasePrice: 50,
      agePricingEnabled: true,
      ageInDays: 120, // 120 days old -> 50% discount
      agePriceRules: sampleAgeRules,
      userDiscountPercent: 0,
    });

    // Shared: $20 - 50% = $10.00
    expect(result.finalShared?.toString()).toBe('10');
    // Exclusive: $50 - 50% = $25.00
    expect(result.finalExclusive?.toString()).toBe('25');
    expect(result.appliedAgeDiscountPercent).toBe(50);
  });
});

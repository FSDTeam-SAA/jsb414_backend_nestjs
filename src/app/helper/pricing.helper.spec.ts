import { validate } from 'class-validator';
import { Prisma } from '../../../prisma/generated/prisma/client';
import { moneyResponse } from './money-response';
import { calculateDynamicLeadPrice, inventoryAge } from './pricing.helper';
import { CreateCategoryDto } from '../module/categories/dto/create-category.dto';
import { CreateAgePriceDto } from '../module/age-price/dto/create-age-price.dto';
import { CreateSubscriptionDto } from '../module/subscription/dto/create-subscription.dto';
import { CardService } from '../module/card/card.service';
import { MarketplaceService } from '../module/marketplace/marketplace.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('Category-owned USD pricing', () => {
  const settings = {
    categorySharedBasePrice: new Prisma.Decimal(2),
    categoryExclusiveBasePrice: new Prisma.Decimal(10),
    agePricingEnabled: false,
    ageInDays: 3,
  };

  it('uses 2 as $2 with no minor-unit scaling', () => {
    expect(calculateDynamicLeadPrice(settings).finalShared?.toNumber()).toBe(2);
  });

  it('reads a changed category price instead of retaining an old lead copy', () => {
    expect(
      calculateDynamicLeadPrice({
        ...settings,
        categorySharedBasePrice: 7.5,
      }).finalShared?.toNumber(),
    ).toBe(7.5);
  });

  it('supports fractional dollar prices exactly and rounds discount once', () => {
    const result = calculateDynamicLeadPrice({
      ...settings,
      categorySharedBasePrice: 2.5,
      userDiscountPercent: 5,
    });
    expect(result.sharedDiscount.toString()).toBe('0.13');
    expect(result.finalShared?.toString()).toBe('2.37');
  });

  it.each([
    [7, 20],
    [8, 17],
    [30, 17],
    [31, 12],
    [90, 12],
    [91, 8],
  ])('matches inclusive age %s to $%s', (ageInDays, expected) => {
    const agePriceRules = [
      { priceType: 'SHARED' as const, minDays: 0, maxDays: 7, price: 20 },
      { priceType: 'SHARED' as const, minDays: 8, maxDays: 30, price: 17 },
      { priceType: 'SHARED' as const, minDays: 31, maxDays: 90, price: 12 },
      { priceType: 'SHARED' as const, minDays: 91, maxDays: null, price: 8 },
    ];
    expect(
      calculateDynamicLeadPrice({
        ...settings,
        agePricingEnabled: true,
        ageInDays,
        agePriceRules,
      }).finalShared?.toNumber(),
    ).toBe(expected);
  });

  it('applies membership after age price: $20 less 10% = $18', () => {
    const result = calculateDynamicLeadPrice({
      ...settings,
      agePricingEnabled: true,
      userDiscountPercent: 10,
      agePriceRules: [
        { priceType: 'SHARED', minDays: 0, maxDays: 7, price: 20 },
      ],
    });
    expect(result.finalShared?.toNumber()).toBe(18);
  });

  it('falls back to category price for age gaps and ignores rules when disabled', () => {
    const agePriceRules = [
      { priceType: 'SHARED' as const, minDays: 8, maxDays: 30, price: 17 },
    ];
    expect(
      calculateDynamicLeadPrice({
        ...settings,
        agePricingEnabled: true,
        agePriceRules,
      }).finalShared?.toNumber(),
    ).toBe(2);
    expect(
      calculateDynamicLeadPrice({
        ...settings,
        ageInDays: 10,
        agePriceRules,
      }).finalShared?.toNumber(),
    ).toBe(2);
  });

  it('does not substitute a made-up default for missing or deliberately free prices', () => {
    expect(
      calculateDynamicLeadPrice({ ...settings, categorySharedBasePrice: null })
        .finalShared,
    ).toBeNull();
    expect(
      calculateDynamicLeadPrice({
        ...settings,
        categorySharedBasePrice: 0,
      }).finalShared?.toNumber(),
    ).toBe(0);
  });

  it('rejects overlapping rules instead of choosing an arbitrary price', () => {
    expect(() =>
      calculateDynamicLeadPrice({
        ...settings,
        agePricingEnabled: true,
        agePriceRules: [
          { priceType: 'SHARED', minDays: 0, maxDays: 7, price: 20 },
          { priceType: 'SHARED', minDays: 0, maxDays: null, price: 10 },
        ],
      }),
    ).toThrow('Overlapping');
  });

  it.each([-1, 101, 2.5])(
    'rejects an invalid membership percentage %s',
    (userDiscountPercent) => {
      expect(() =>
        calculateDynamicLeadPrice({ ...settings, userDiscountPercent }),
      ).toThrow('discount');
    },
  );

  it('returns JSON dollar numbers, keeps timestamps, and excludes archived price fields', () => {
    const date = new Date('2026-10-28T00:00:00Z');
    const result = moneyResponse({
      price: new Prisma.Decimal('2.50'),
      nested: [{ amount: new Prisma.Decimal(2) }],
      createdAt: date,
      legacySharedPrice: new Prisma.Decimal(999),
    });
    expect(result).toEqual({
      price: 2.5,
      nested: [{ amount: 2 }],
      createdAt: date,
    });
    expect(JSON.stringify(result)).not.toContain('legacy');
  });

  it('measures age from inventory creation rather than an update', () => {
    expect(
      inventoryAge(
        new Date('2026-10-25T12:00:00Z'),
        new Date('2026-10-28T11:00:00Z'),
      ),
    ).toBe(2);
  });

  it.each([2, 2.5, 1000])(
    'accepts direct dollar value %s in category, age rule and plan DTOs',
    async (price) => {
      expect(
        await validate(
          Object.assign(new CreateCategoryDto(), {
            name: 'Mortgage',
            sharedBasePrice: price,
            exclusiveBasePrice: price,
          }),
        ),
      ).toHaveLength(0);
      expect(
        await validate(
          Object.assign(new CreateAgePriceDto(), {
            categoryId: '11111111-1111-4111-8111-111111111111',
            priceType: 'SHARED',
            minDays: 0,
            price,
          }),
        ),
      ).toHaveLength(0);
      expect(
        await validate(
          Object.assign(new CreateSubscriptionDto(), {
            title: 'Silver',
            subTitle: 'Monthly',
            price,
            discount: 5,
          }),
        ),
      ).toHaveLength(0);
    },
  );

  it('keeps Marketplace and Cart consistent without leaking an old lead price', async () => {
    const category = {
      id: 'category-1',
      name: 'Mortgage',
      isActive: true,
      sharedBasePrice: new Prisma.Decimal(2),
      exclusiveBasePrice: new Prisma.Decimal(10),
      agePricingEnabled: false,
      agePriceRules: [],
    };
    const lead = {
      id: 'lead-1',
      leadNumber: 1,
      category,
      categoryId: category.id,
      legacySharedPrice: new Prisma.Decimal(999),
      status: 'ACTIVE',
      classification: 'SELLABLE',
      availability: 'BOTH',
      exclusiveSoldAt: null,
      sharedLimit: 5,
      sharedSalesCount: 0,
      createdAt: new Date(),
      city: 'Miami',
      state: 'FL',
      zipcode: '33132',
    };
    const db: any = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ walletBalance: new Prisma.Decimal(2) }),
      },
      userSubscribe: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ subscribe: { discount: 10, title: 'Gold' } }),
      },
      cartItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'cart-1', priceType: 'SHARED', lead, createdAt: new Date() },
          ]),
      },
      lead: {
        findMany: jest.fn().mockResolvedValue([lead]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const cart = moneyResponse(
      await new CardService(db as PrismaService).getCart('user-1'),
    );
    const market = moneyResponse(
      await new MarketplaceService(db as PrismaService).getAllMarketPlace(
        {},
        {},
        'user-1',
      ),
    );
    expect(cart.items[0].originalPrice).toBe(2);
    expect(cart.items[0].finalPrice).toBe(1.8);
    expect(cart.summary.total).toBe(1.8);
    expect(market.data[0].sharedPrice).toBe(cart.items[0].finalPrice);
    expect(JSON.stringify(market)).not.toContain('legacySharedPrice');
    category.sharedBasePrice = new Prisma.Decimal(5);
    const updated = moneyResponse(
      await new CardService(db as PrismaService).getCart('user-1'),
    );
    expect(updated.summary.total).toBe(4.5);
  });
});

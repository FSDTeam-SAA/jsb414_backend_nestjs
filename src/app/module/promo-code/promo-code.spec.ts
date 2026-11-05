import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PromoCodeService } from './promo-code.service';

describe('PromoCodeService', () => {
  let service: PromoCodeService;
  let db: any;

  beforeEach(() => {
    db = {
      promoCode: {
        create: jest.fn().mockImplementation(({ data }: any) => ({
          id: 'promo_123',
          ...data,
          usedCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn().mockImplementation(({ where, data }: any) => ({
          id: where.id,
          code: 'WELCOME',
          discount: 5,
          claimedUser: 150,
          usedCount: 0,
          isActive: true,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        delete: jest.fn().mockResolvedValue({ id: 'promo_123' }),
      },
      promoCodeUsage: {
        create: jest.fn(),
      },
    };

    service = new PromoCodeService(db as PrismaService);
  });

  describe('createPromoCode (Figma: New Promo Code Modal)', () => {
    it('creates promo code with Code Name, Code Discount, and Claimed User', async () => {
      db.promoCode.findUnique.mockResolvedValueOnce(null);

      const result = await service.createPromoCode({
        code: 'welcome',
        discount: 5,
        claimedUser: 150,
      });

      expect(db.promoCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'WELCOME',
            discount: 5,
            claimedUser: 150,
            isActive: true,
          }),
        }),
      );
      expect(result.data.code).toBe('WELCOME');
      expect(result.data.discount).toBe(5);
      expect(result.data.discountAmount).toBe('$5');
      expect(result.data.claimed).toBe(150);
      expect(result.data.activity).toBe(true);
    });

    it('throws ConflictException if code already exists', async () => {
      db.promoCode.findUnique.mockResolvedValueOnce({ id: 'existing' });

      await expect(
        service.createPromoCode({
          code: 'WELCOME',
          discount: 5,
          claimedUser: 150,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('togglePromoCodeStatus (Figma: Activity Switch)', () => {
    it('toggles promo code from active to inactive (Turn OFF)', async () => {
      db.promoCode.findUnique.mockResolvedValueOnce({
        id: 'promo_1',
        code: 'WELCOME',
        isActive: true,
      });

      const result = await service.togglePromoCodeStatus('promo_1');

      expect(db.promoCode.update).toHaveBeenCalledWith({
        where: { id: 'promo_1' },
        data: { isActive: false },
      });
      expect(result.message).toContain('OFF');
      expect(result.data.activity).toBe(false);
    });

    it('toggles promo code from inactive to active (Turn ON)', async () => {
      db.promoCode.findUnique.mockResolvedValueOnce({
        id: 'promo_1',
        code: 'WELCOME',
        isActive: false,
      });

      const result = await service.togglePromoCodeStatus('promo_1');

      expect(db.promoCode.update).toHaveBeenCalledWith({
        where: { id: 'promo_1' },
        data: { isActive: true },
      });
      expect(result.message).toContain('ON');
      expect(result.data.activity).toBe(true);
    });
  });

  describe('validatePromoCode (Figma: Apply Promo Code in Purchase Summary)', () => {
    it('calculates dollar discount accurately', async () => {
      db.promoCode.findUnique.mockResolvedValueOnce({
        id: 'promo_1',
        code: 'WELCOME',
        discount: 5,
        claimedUser: 150,
        usedCount: 10,
        isActive: true,
      });

      const result = await service.validatePromoCode('user_1', {
        code: 'welcome',
        subtotal: 50,
      });

      expect(result.valid).toBe(true);
      expect(result.discount).toBe(5);
      expect(result.discountAmount).toBe(5);
      expect(result.finalAmount).toBe(45);
    });

    it('rejects if promo code is inactive (Admin turned OFF in Activity column)', async () => {
      db.promoCode.findUnique.mockResolvedValueOnce({
        id: 'promo_1',
        code: 'WELCOME',
        discount: 5,
        claimedUser: 150,
        usedCount: 0,
        isActive: false,
      });

      await expect(
        service.validatePromoCode('user_1', {
          code: 'WELCOME',
          subtotal: 50,
        }),
      ).rejects.toThrow('This promo code is currently inactive');
    });

    it('rejects if promo code reached its claimed limit', async () => {
      db.promoCode.findUnique.mockResolvedValueOnce({
        id: 'promo_1',
        code: 'WELCOME',
        discount: 5,
        claimedUser: 100,
        usedCount: 100,
        isActive: true,
      });

      await expect(
        service.validatePromoCode('user_1', {
          code: 'WELCOME',
          subtotal: 50,
        }),
      ).rejects.toThrow('maximum claimed limit');
    });
  });
});

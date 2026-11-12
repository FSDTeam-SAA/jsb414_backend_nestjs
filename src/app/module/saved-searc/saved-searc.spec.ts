import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { NotificationService } from '../notification/notification.service';
import { SavedSearcService } from './saved-searc.service';

describe('SavedSearcService', () => {
  let service: SavedSearcService;
  let db: any;
  let mockMarketplaceService: any;
  let mockNotificationService: any;

  beforeEach(() => {
    db = {
      user: {
        findUnique: jest.fn(),
      },
      savedSearch: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockMarketplaceService = {
      getAllMarketPlace: jest.fn(),
    };

    mockNotificationService = {
      createNotification: jest.fn(),
    };

    service = new SavedSearcService(
      db as PrismaService,
      mockMarketplaceService as MarketplaceService,
      mockNotificationService as NotificationService,
    );
  });

  describe('createSavedSearch', () => {
    it('creates a new saved search for a valid user', async () => {
      db.user.findUnique.mockResolvedValueOnce({ id: 'u_1' });
      db.savedSearch.create.mockResolvedValueOnce({
        id: 'ss_1',
        userId: 'u_1',
        title: 'Miami Pre-foreclosures',
        filters: { city: 'Miami' },
      });

      const result = await service.createSavedSearch('u_1', {
        title: 'Miami Pre-foreclosures',
        filters: { city: 'Miami' } as any,
      });

      expect(result.id).toBe('ss_1');
      expect(db.savedSearch.create).toHaveBeenCalledWith({
        data: {
          userId: 'u_1',
          title: 'Miami Pre-foreclosures',
          filters: { city: 'Miami' },
        },
      });
    });

    it('throws NotFoundException if user does not exist', async () => {
      db.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createSavedSearch('u_invalid', {
          title: 'Test',
          filters: {} as any,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSavedSearches', () => {
    it('returns paginated saved searches', async () => {
      db.user.findUnique.mockResolvedValueOnce({ id: 'u_1' });
      db.savedSearch.findMany.mockResolvedValueOnce([
        { id: 'ss_1', title: 'Search 1' },
      ]);
      db.savedSearch.count.mockResolvedValueOnce(1);

      const result = await service.getSavedSearches('u_1', {}, {});
      expect(result.data.length).toBe(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getNewMatchingLeads', () => {
    it('returns new leads added in the last 24h for a saved search', async () => {
      db.savedSearch.findFirst.mockResolvedValueOnce({
        id: 'ss_1',
        userId: 'u_1',
        title: 'Orlando Deals',
        filters: { city: 'Orlando' },
      });

      mockMarketplaceService.getAllMarketPlace.mockResolvedValueOnce({
        meta: { total: 3 },
        data: [{ id: 'lead_1' }, { id: 'lead_2' }, { id: 'lead_3' }],
      });

      const result = await service.getNewMatchingLeads('u_1', 'ss_1');
      expect(result.savedSearchId).toBe('ss_1');
      expect(result.newLeadsCount).toBe(3);
      expect(result.newLeads.length).toBe(3);
    });
  });

  describe('triggerDailyDigest', () => {
    it('checks all saved searches and triggers notifications when new leads exist', async () => {
      db.savedSearch.findMany.mockResolvedValueOnce([
        {
          id: 'ss_1',
          userId: 'u_1',
          title: 'Tampa Homes',
          filters: { city: 'Tampa' },
          user: { id: 'u_1', email: 'u1@test.com', firstName: 'User 1' },
        },
      ]);

      mockMarketplaceService.getAllMarketPlace.mockResolvedValueOnce({
        meta: { total: 2 },
        data: [{ id: 'lead_10' }],
      });

      const result = await service.triggerDailyDigest();
      expect(result.searchesChecked).toBe(1);
      expect(result.notificationsSent).toBe(1);
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u_1',
          title: 'New Matching Leads Alert',
          type: 'SAVED_SEARCH_ALERT',
        }),
      );
    });
  });
});

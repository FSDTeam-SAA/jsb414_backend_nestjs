import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: NotificationService;

  const mockNotificationService = {
    getMyNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    clearAllRead: jest.fn(),
    deleteNotification: jest.fn(),
    sendDirectNotification: jest.fn(),
    broadcastNotification: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockPrismaService = {
    user: { findUnique: jest.fn() },
  };

  const userId = '11111111-1111-4111-8111-111111111111';
  const req = { user: { id: userId, role: 'user' } } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUnreadCount', () => {
    it('should return unread count for user badge', async () => {
      mockNotificationService.getUnreadCount.mockResolvedValueOnce({
        unreadCount: 3,
      });

      const res = await controller.getUnreadCount(req);
      expect(res.data).toEqual({ unreadCount: 3 });
      expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith(
        userId,
      );
    });
  });

  describe('getMyNotifications', () => {
    it('should return notifications list', async () => {
      const mockResult = {
        data: [{ id: '1', title: 'Test' }],
        meta: { page: 1, limit: 10, total: 1, totalPage: 1 },
        unreadCount: 1,
      };
      mockNotificationService.getMyNotifications.mockResolvedValueOnce(
        mockResult,
      );

      const res = await controller.getMyNotifications(req, {
        page: 1,
        limit: 10,
      });
      expect(res.data).toEqual(mockResult.data);
      expect(res.unreadCount).toBe(1);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValueOnce({
        message: 'All notifications marked as read',
        markedCount: 5,
      });

      const res = await controller.markAllAsRead(req);
      expect(res.markedCount).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      mockNotificationService.markAsRead.mockResolvedValueOnce({
        message: 'Notification marked as read',
        data: { id: 'notif-1', isRead: true },
      });

      const res = await controller.markAsRead(
        req,
        '00000000-0000-0000-0000-000000000001',
      );
      expect(res.data.isRead).toBe(true);
    });
  });

  describe('clearAllRead', () => {
    it('should delete all read notifications', async () => {
      mockNotificationService.clearAllRead.mockResolvedValueOnce({
        message: 'All read notifications cleared',
        deletedCount: 4,
      });

      const res = await controller.clearAllRead(req);
      expect(res.deletedCount).toBe(4);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification', async () => {
      mockNotificationService.deleteNotification.mockResolvedValueOnce({
        message: 'Notification deleted successfully',
      });

      const res = await controller.deleteNotification(
        req,
        '00000000-0000-0000-0000-000000000001',
      );
      expect(res.message).toBe('Notification deleted successfully');
    });
  });

  describe('sendDirectNotification', () => {
    it('should allow admin to send direct notification', async () => {
      mockNotificationService.sendDirectNotification.mockResolvedValueOnce({
        message: 'Notification sent successfully',
        data: { id: 'n1' },
      });

      const res = await controller.sendDirectNotification({
        userId,
        title: 'Alert',
        message: 'Important message',
      });

      expect(res.message).toBe('Notification sent successfully');
    });
  });

  describe('broadcastNotification', () => {
    it('should allow admin to broadcast notification', async () => {
      mockNotificationService.broadcastNotification.mockResolvedValueOnce({
        message: 'Broadcast successfully sent to 10 users',
        count: 10,
      });

      const res = await controller.broadcastNotification({
        title: 'Promo',
        message: '50% off',
      });

      expect(res.count).toBe(10);
    });
  });
});

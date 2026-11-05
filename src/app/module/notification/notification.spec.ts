import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let db: any;

  const userId = '11111111-1111-4111-8111-111111111111';
  const notificationId = 'notif-uuid-1';

  beforeEach(async () => {
    db = {
      notification: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: db },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMyNotifications', () => {
    it('should return paginated notifications and unreadCount', async () => {
      const mockNotifications = [
        {
          id: 'n1',
          userId,
          title: 'Order Confirmed',
          message: 'Order #1001 was placed',
          type: 'ORDER',
          isRead: false,
          createdAt: new Date(),
        },
      ];

      db.notification.findMany.mockResolvedValueOnce(mockNotifications);
      db.notification.count
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(1); // unreadCount

      const result = await service.getMyNotifications(userId, {
        page: 1,
        limit: 10,
      });

      expect(result.data).toEqual(mockNotifications);
      expect(result.meta.total).toBe(1);
      expect(result.unreadCount).toBe(1);
      expect(db.notification.findMany).toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for user badge', async () => {
      db.notification.count.mockResolvedValueOnce(5);

      const result = await service.getUnreadCount(userId);
      expect(result).toEqual({ unreadCount: 5 });
      expect(db.notification.count).toHaveBeenCalledWith({
        where: { userId, isRead: false },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark an unread notification as read', async () => {
      db.notification.findFirst.mockResolvedValueOnce({
        id: notificationId,
        userId,
        isRead: false,
      });
      db.notification.update.mockResolvedValueOnce({
        id: notificationId,
        userId,
        isRead: true,
      });

      const result = await service.markAsRead(userId, notificationId);
      expect(result.message).toBe('Notification marked as read');
      expect(result.data.isRead).toBe(true);
      expect(db.notification.update).toHaveBeenCalledWith({
        where: { id: notificationId },
        data: { isRead: true },
      });
    });

    it('should throw NotFoundException if notification is not found', async () => {
      db.notification.findFirst.mockResolvedValueOnce(null);

      await expect(service.markAsRead(userId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      db.notification.updateMany.mockResolvedValueOnce({ count: 4 });

      const result = await service.markAllAsRead(userId);
      expect(result.markedCount).toBe(4);
      expect(db.notification.updateMany).toHaveBeenCalledWith({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification successfully', async () => {
      db.notification.findFirst.mockResolvedValueOnce({
        id: notificationId,
        userId,
      });
      db.notification.delete.mockResolvedValueOnce({ id: notificationId });

      const result = await service.deleteNotification(userId, notificationId);
      expect(result.message).toBe('Notification deleted successfully');
      expect(db.notification.delete).toHaveBeenCalledWith({
        where: { id: notificationId },
      });
    });

    it('should throw NotFoundException when deleting non-existent notification', async () => {
      db.notification.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.deleteNotification(userId, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearAllRead', () => {
    it('should delete all read notifications', async () => {
      db.notification.deleteMany.mockResolvedValueOnce({ count: 7 });

      const result = await service.clearAllRead(userId);
      expect(result.deletedCount).toBe(7);
      expect(db.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId, isRead: true },
      });
    });
  });

  describe('createNotification', () => {
    it('should create a notification for single user', async () => {
      const mockCreated = {
        id: 'n_new',
        userId,
        title: 'Welcome',
        message: 'Welcome to Foreclosure Gold',
        type: 'SYSTEM',
        isRead: false,
      };
      db.notification.create.mockResolvedValueOnce(mockCreated);

      const result = await service.createNotification({
        userId,
        title: 'Welcome',
        message: 'Welcome to Foreclosure Gold',
      });

      expect(result).toEqual(mockCreated);
      expect(db.notification.create).toHaveBeenCalled();
    });
  });

  describe('notifyAdmins', () => {
    it('should query admins and create notification for each', async () => {
      db.user.findMany.mockResolvedValueOnce([
        { id: 'admin_1' },
        { id: 'admin_2' },
      ]);
      db.notification.createMany.mockResolvedValueOnce({ count: 2 });

      const result = await service.notifyAdmins({
        title: 'New Lead Purchased',
        message: 'Lead #40 was purchased',
        type: 'ORDER',
      });

      expect(db.user.findMany).toHaveBeenCalledWith({
        where: { role: { in: ['admin', 'superadmin'] } },
        select: { id: true },
      });
      expect(db.notification.createMany).toHaveBeenCalled();
      expect(result).toEqual({ count: 2 });
    });
  });

  describe('sendDirectNotification', () => {
    it('should send notification to specific user', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        id: userId,
        email: 'user@test.com',
      });
      db.notification.create.mockResolvedValueOnce({
        id: 'n_direct',
        userId,
        title: 'Notice',
        message: 'Important update',
      });

      const result = await service.sendDirectNotification({
        userId,
        title: 'Notice',
        message: 'Important update',
      });

      expect(result.message).toBe('Notification sent successfully');
      expect(result.data.id).toBe('n_direct');
    });

    it('should throw NotFoundException if recipient user is not found', async () => {
      db.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.sendDirectNotification({
          userId: 'missing_user',
          title: 'Notice',
          message: 'Important update',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('broadcastNotification', () => {
    it('should broadcast notification to all users', async () => {
      db.user.findMany.mockResolvedValueOnce([
        { id: 'user_1' },
        { id: 'user_2' },
        { id: 'user_3' },
      ]);
      db.notification.createMany.mockResolvedValueOnce({ count: 3 });

      const result = await service.broadcastNotification({
        title: 'Holiday Discount',
        message: 'Get 20% off all leads today!',
      });

      expect(result.message).toContain('Broadcast successfully sent to 3 users');
      expect(result.count).toBe(3);
    });
  });
});

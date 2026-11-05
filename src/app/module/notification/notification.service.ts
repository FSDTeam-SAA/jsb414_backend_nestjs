import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/prisma/client';
import { NotificationType } from '../../../../prisma/generated/prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import paginationHelper from '../../helper/pagenation';
import { NotificationQueryDto } from './dto/notification-query.dto';
import {
  BroadcastNotificationDto,
  SendNotificationDto,
} from './dto/send-notification.dto';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  // ১. ইউজারের নোটিফিকেশন তালিকা (প্যাজিনেশন + ফিল্টারিং + সাথে unreadCount)
  async getMyNotifications(userId: string, query: NotificationQueryDto) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    const where: Prisma.NotificationWhereInput = {
      userId,
    };

    if (query.isRead !== undefined) {
      where.isRead = String(query.isRead) === 'true';
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.searchTerm && query.searchTerm.trim() !== '') {
      const term = query.searchTerm.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { message: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy || 'createdAt']: sortOrder || 'desc',
        },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit) || 1,
      },
      unreadCount,
    };
  }

  // ২. বেল আইকন ব্যাজের (🔔) জন্য দ্রুত unread count
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  // ৩. একক নোটিফিকেশন পঠিত (Read) মার্ক করা
  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.isRead) {
      return {
        message: 'Notification already marked as read',
        data: notification,
      };
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return {
      message: 'Notification marked as read',
      data: updated,
    };
  }

  // ৪. ইউজারের সকল অপঠিত নোটিফিকেশন একসাথে Read মার্ক করা
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return {
      message: 'All notifications marked as read',
      markedCount: result.count,
    };
  }

  // ৫. একক নোটিফিকেশন ডিলিট করা
  async deleteNotification(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    return {
      message: 'Notification deleted successfully',
    };
  }

  // ৬. পঠিত (Read) সকল নোটিফিকেশন মুছে ফেলা
  async clearAllRead(userId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: {
        userId,
        isRead: true,
      },
    });

    return {
      message: 'All read notifications cleared',
      deletedCount: result.count,
    };
  }

  // ৭. ইন্টারনাল হেল্পার: একজন নির্দিষ্ট ইউজারকে নোটিফিকেশন তৈরি
  async createNotification(data: {
    userId: string;
    title: string;
    message: string;
    type?: NotificationType;
    link?: string;
  }) {
    try {
      return await this.prisma.notification.create({
        data: {
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.type || 'SYSTEM',
          link: data.link || null,
        },
      });
    } catch (err: any) {
      console.error('Failed to create notification:', err?.message || err);
      return null;
    }
  }

  // ৮. ইন্টারনাল হেল্পার: একাধিক ইউজারকে একসাথে নোটিফিকেশন তৈরি
  async createManyNotifications(data: {
    userIds: string[];
    title: string;
    message: string;
    type?: NotificationType;
    link?: string;
  }) {
    if (!data.userIds || data.userIds.length === 0) {
      return { count: 0 };
    }

    try {
      const records = data.userIds.map((userId) => ({
        userId,
        title: data.title,
        message: data.message,
        type: data.type || ('SYSTEM' as NotificationType),
        link: data.link || null,
      }));

      return await this.prisma.notification.createMany({
        data: records,
      });
    } catch (err: any) {
      console.error('Failed to create many notifications:', err?.message || err);
      return { count: 0 };
    }
  }

  // ৯. ইন্টারনাল হেল্পার: সমস্ত অ্যাডমিন ও সুপারঅ্যাডমিনদের নোটিফাই করা
  async notifyAdmins(data: {
    title: string;
    message: string;
    type?: NotificationType;
    link?: string;
  }) {
    try {
      const admins = await this.prisma.user.findMany({
        where: {
          role: {
            in: ['admin', 'superadmin'],
          },
        },
        select: { id: true },
      });

      if (admins.length === 0) return { count: 0 };

      return await this.createManyNotifications({
        userIds: admins.map((a) => a.id),
        title: data.title,
        message: data.message,
        type: data.type || 'SYSTEM',
        link: data.link,
      });
    } catch (err: any) {
      console.error('Failed to notify admins:', err?.message || err);
      return { count: 0 };
    }
  }

  // ১০. অ্যাডমিন অ্যাকশন: নির্দিষ্ট ইউজারকে সরাসরি নোটিফিকেশন পাঠানো
  async sendDirectNotification(dto: SendNotificationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('Recipient user not found');
    }

    const notification = await this.createNotification(dto);
    return {
      message: 'Notification sent successfully',
      data: notification,
    };
  }

  // ১১. অ্যাডমিন অ্যাকশন: সমস্ত রেজিস্টার্ড ইউজারকে নোটিফিকেশন ব্রডকাস্ট করা
  async broadcastNotification(dto: BroadcastNotificationDto) {
    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    if (users.length === 0) {
      return {
        message: 'No users found to broadcast to',
        count: 0,
      };
    }

    const result = await this.createManyNotifications({
      userIds: users.map((u) => u.id),
      title: dto.title,
      message: dto.message,
      type: dto.type || 'SYSTEM',
      link: dto.link,
    });

    return {
      message: `Broadcast successfully sent to ${result.count} users`,
      count: result.count,
    };
  }
}

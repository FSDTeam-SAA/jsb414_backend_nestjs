import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContactStatus } from '../../../../prisma/generated/prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ContactupService } from './contactup.service';

// Mock sendMailer
jest.mock('src/app/helper/sendMailer', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

describe('ContactupService', () => {
  let service: ContactupService;

  const mockPrisma = {
    contactUs: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockNotificationService = {
    notifyAdmins: jest.fn().mockResolvedValue(true),
    createNotification: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactupService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<ContactupService>(ContactupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSendMessage (Form 1: SEND US A MESSAGE)', () => {
    it('should create a contact inquiry with type CONTACT and issueType string', async () => {
      const dto = {
        firstName: 'John',
        lastName: 'Smith',
        phoneNumber: '(555) 000-0000',
        email: 'john@example.com',
        interestedIn: 'Tax Foreclosure',
        message: 'Looking for 50 leads per month in Florida.',
      };

      const mockCreated = {
        id: '11111111-1111-4111-8111-111111111111',
        ...dto,
        name: 'John Smith',
        type: 'CONTACT',
        issueType: 'Tax Foreclosure',
        subject: 'Interested in Tax Foreclosure',
        status: ContactStatus.PENDING,
        userId: null,
      };

      mockPrisma.contactUs.create.mockResolvedValue(mockCreated);

      const result = await service.createSendMessage(dto);

      expect(mockPrisma.contactUs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: 'John',
          lastName: 'Smith',
          name: 'John Smith',
          email: 'john@example.com',
          phoneNumber: '(555) 000-0000',
          type: 'CONTACT',
          issueType: 'Tax Foreclosure',
          subject: 'Interested in Tax Foreclosure',
          message: dto.message,
          status: ContactStatus.PENDING,
        }),
      });
      expect(result).toEqual(mockCreated);
      expect(mockNotificationService.notifyAdmins).toHaveBeenCalled();
    });

    it('should link userId if user exists', async () => {
      const dto = {
        firstName: 'John',
        lastName: 'Smith',
        phoneNumber: '(555) 000-0000',
        email: 'john@example.com',
        message: 'Hello world',
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123' });
      mockPrisma.contactUs.create.mockResolvedValue({
        id: 'msg-1',
        ...dto,
        userId: 'user-123',
      });

      const result = await service.createSendMessage(dto, 'user-123');
      expect(mockPrisma.contactUs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
        }),
      });
      expect(result.userId).toBe('user-123');
    });
  });

  describe('createSupportRequest (Form 2: SUBMIT A SUPPORT REQUEST)', () => {
    it('should create a support request with type SUPPORT and issueType string without enum', async () => {
      const dto = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phoneNumber: '(555) 123-4567',
        issueType: 'Billing & Checkout',
        describeYourIssue: 'My credit card was charged twice.',
      };

      const mockCreated = {
        id: '22222222-2222-4222-8222-222222222222',
        firstName: 'Jane',
        lastName: 'Doe',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phoneNumber: '(555) 123-4567',
        type: 'SUPPORT',
        issueType: 'Billing & Checkout',
        subject: 'Support Request: Billing & Checkout',
        message: 'My credit card was charged twice.',
        status: ContactStatus.PENDING,
        userId: null,
      };

      mockPrisma.contactUs.create.mockResolvedValue(mockCreated);

      const result = await service.createSupportRequest(dto);

      expect(mockPrisma.contactUs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Doe',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phoneNumber: '(555) 123-4567',
          type: 'SUPPORT',
          issueType: 'Billing & Checkout',
          subject: 'Support Request: Billing & Checkout',
          message: 'My credit card was charged twice.',
          status: ContactStatus.PENDING,
        }),
      });
      expect(result).toEqual(mockCreated);
      expect(mockNotificationService.notifyAdmins).toHaveBeenCalled();
    });

    it('should throw BadRequestException if message is missing', async () => {
      const dto = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
      };

      await expect(service.createSupportRequest(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMyContactUs (User view)', () => {
    it('should return paginated inquiries belonging to userId', async () => {
      const list = [
        {
          id: '1',
          type: 'SUPPORT',
          subject: 'Support Ticket',
          status: ContactStatus.PENDING,
        },
      ];
      mockPrisma.contactUs.findMany.mockResolvedValue(list);
      mockPrisma.contactUs.count.mockResolvedValue(1);

      const result = await service.getMyContactUs(
        'user-1',
        { type: 'SUPPORT' },
        { page: 1, limit: 10 },
      );

      expect(result.data).toEqual(list);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getAllContactUs (Admin view)', () => {
    it('should return all messages with filtering and relations', async () => {
      const list = [
        {
          id: '1',
          type: 'CONTACT',
          name: 'John Smith',
          status: ContactStatus.PENDING,
        },
      ];
      mockPrisma.contactUs.findMany.mockResolvedValue(list);
      mockPrisma.contactUs.count.mockResolvedValue(1);

      const result = await service.getAllContactUs(
        { searchTerm: 'John', type: 'CONTACT' },
        { page: 1, limit: 10 },
      );

      expect(result.data).toEqual(list);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getStats (Admin statistics)', () => {
    it('should return count breakdown across statuses and types', async () => {
      mockPrisma.contactUs.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(4) // pending
        .mockResolvedValueOnce(3) // inProgress
        .mockResolvedValueOnce(2) // resolved
        .mockResolvedValueOnce(1) // closed
        .mockResolvedValueOnce(6) // contactCount
        .mockResolvedValueOnce(4); // supportCount

      const stats = await service.getStats();

      expect(stats).toEqual({
        total: 10,
        pending: 4,
        inProgress: 3,
        resolved: 2,
        closed: 1,
        contactCount: 6,
        supportCount: 4,
      });
    });
  });

  describe('adminReply', () => {
    it('should update status, save adminReply, send email, and notify user', async () => {
      const mockRecord = {
        id: 'msg-1',
        email: 'john@example.com',
        name: 'John Smith',
        subject: 'General Question',
        message: 'How do I download leads?',
        type: 'CONTACT',
        userId: 'user-123',
        status: ContactStatus.PENDING,
        resolvedAt: null,
      };

      mockPrisma.contactUs.findUnique.mockResolvedValue(mockRecord);
      mockPrisma.contactUs.update.mockResolvedValue({
        ...mockRecord,
        adminReply: 'You can download leads from the dashboard.',
        status: ContactStatus.RESOLVED,
        resolvedAt: new Date(),
      });

      const replyResult = await service.adminReply('msg-1', {
        adminReply: 'You can download leads from the dashboard.',
        status: ContactStatus.RESOLVED,
        sendEmail: true,
      });

      expect(mockPrisma.contactUs.update).toHaveBeenCalled();
      expect(replyResult.adminReply).toBe(
        'You can download leads from the dashboard.',
      );
      expect(replyResult.status).toBe(ContactStatus.RESOLVED);
      expect(mockNotificationService.createNotification).toHaveBeenCalled();
    });

    it('should throw NotFoundException if inquiry does not exist', async () => {
      mockPrisma.contactUs.findUnique.mockResolvedValue(null);

      await expect(
        service.adminReply('not-found', {
          adminReply: 'test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update ticket status', async () => {
      mockPrisma.contactUs.findUnique.mockResolvedValue({
        id: 'msg-1',
        status: ContactStatus.PENDING,
      });
      mockPrisma.contactUs.update.mockResolvedValue({
        id: 'msg-1',
        status: ContactStatus.IN_PROGRESS,
      });

      const result = await service.updateStatus(
        'msg-1',
        ContactStatus.IN_PROGRESS,
      );
      expect(result.status).toBe(ContactStatus.IN_PROGRESS);
    });
  });
});

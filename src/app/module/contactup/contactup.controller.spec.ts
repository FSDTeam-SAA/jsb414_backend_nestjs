import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ContactStatus } from '../../../../prisma/generated/prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { ContactupController } from './contactup.controller';
import { ContactupService } from './contactup.service';

describe('ContactupController', () => {
  let controller: ContactupController;

  const mockContactupService = {
    createSendMessage: jest.fn(),
    createSupportRequest: jest.fn(),
    createContactUs: jest.fn(),
    getMyContactUs: jest.fn(),
    getContactUsById: jest.fn(),
    getAllContactUs: jest.fn(),
    adminReply: jest.fn(),
    updatectConta: jest.fn(),
    deleteContactUs: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockPrismaService = {
    user: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactupController],
      providers: [
        { provide: ContactupService, useValue: mockContactupService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<ContactupController>(ContactupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /contact-us/send-message (New API 1)', () => {
    it('should submit Send Us A Message successfully', async () => {
      const dto = {
        firstName: 'John',
        lastName: 'Smith',
        phoneNumber: '(555) 000-0000',
        email: 'john@example.com',
        interestedIn: 'Probate Leads',
        message: 'I want to know about pricing.',
      };

      mockContactupService.createSendMessage.mockResolvedValue({
        id: 'msg-1',
        ...dto,
      });

      const req = { user: undefined } as any;
      const res = await controller.createSendMessage(req, dto);

      expect(res.message).toBeDefined();
      expect(mockContactupService.createSendMessage).toHaveBeenCalledWith(
        dto,
        undefined,
      );
    });
  });

  describe('POST /contact-us/support-request (New API 2)', () => {
    it('should submit Support Request successfully', async () => {
      const dto = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        issueType: 'Account Login',
        describeYourIssue: 'Cannot reset password.',
      };

      mockContactupService.createSupportRequest.mockResolvedValue({
        id: 'sup-1',
        ...dto,
      });

      const req = { user: { id: 'user-1' } } as any;
      const res = await controller.createSupportRequest(req, dto);

      expect(res.message).toBeDefined();
      expect(mockContactupService.createSupportRequest).toHaveBeenCalledWith(
        dto,
        'user-1',
      );
    });
  });

  describe('POST /contact-us (Original API)', () => {
    it('should submit contact message for authenticated user', async () => {
      const dto = {
        subject: 'General Question',
        message: 'How do I upgrade?',
      };

      mockContactupService.createContactUs.mockResolvedValue({
        id: 'msg-orig',
        ...dto,
      });

      const req = { user: { id: 'user-1' } } as any;
      const res = await controller.createContactUs(req, dto as any);

      expect(res.message).toBe('Contact message submitted successfully');
      expect(mockContactupService.createContactUs).toHaveBeenCalledWith(
        dto,
        'user-1',
      );
    });
  });

  describe('GET /contact-us/my (Original API)', () => {
    it('should fetch my contact messages', async () => {
      mockContactupService.getMyContactUs.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPage: 0 },
      });

      const req = {
        user: { id: 'user-1' },
        query: { page: '1', limit: '10' },
      } as any;
      const res = await controller.getMyContactUs(req);

      expect(res.message).toBe('My contact messages fetched successfully');
      expect(mockContactupService.getMyContactUs).toHaveBeenCalled();
    });
  });

  describe('GET /contact-us (Original API)', () => {
    it('should fetch all contact messages for admin', async () => {
      mockContactupService.getAllContactUs.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPage: 0 },
      });

      const req = {
        user: { id: 'admin-1', role: 'admin' },
        query: { page: '1', limit: '10' },
      } as any;
      const res = await controller.getAllContactUs(req);

      expect(res.message).toBe('All contact messages fetched successfully');
      expect(mockContactupService.getAllContactUs).toHaveBeenCalled();
    });
  });

  describe('POST /contact-us/:id/reply (Original API)', () => {
    it('should reply to ticket', async () => {
      const dto = {
        adminReply: 'Here is the solution.',
        status: ContactStatus.RESOLVED,
        sendEmail: true,
      };

      mockContactupService.adminReply.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        adminReply: dto.adminReply,
        status: dto.status,
      });

      const res = await controller.adminReply(
        '11111111-1111-4111-8111-111111111111',
        dto,
      );

      expect(res.message).toBe('Admin reply sent successfully');
      expect(mockContactupService.adminReply).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        dto,
      );
    });
  });
});

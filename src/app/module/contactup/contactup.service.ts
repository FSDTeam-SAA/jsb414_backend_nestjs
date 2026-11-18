import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import buildWhereConditions from 'src/app/helper/buildWhereConditions';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import sendMailer from 'src/app/helper/sendMailer';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContactStatus } from '../../../../prisma/generated/prisma/enums';
import { NotificationService } from '../notification/notification.service';
import { AdminReplyContactupDto } from './dto/admin-reply-contactup.dto';
import { CreateContactupDto } from './dto/create-contactup.dto';
import { CreateSendMessageDto } from './dto/create-send-message.dto';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { UpdateContactupDto } from './dto/update-contactup.dto';

@Injectable()
export class ContactupService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationService?: NotificationService,
  ) {}

  /**
   * Solution 1: SEND US A MESSAGE (Contact / Lead Inquiry)
   */
  async createSendMessage(dto: CreateSendMessageDto, userId?: string) {
    const fullName = `${dto.firstName} ${dto.lastName}`.trim();
    const issueType = dto.interestedIn || dto.issueType || null;
    const subject = issueType
      ? `Interested in ${issueType}`
      : 'General Inquiry';

    // Verify user exists if userId was provided
    let linkedUserId: string | null = null;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user) {
        linkedUserId = user.id;
      }
    }

    const result = await this.prisma.contactUs.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        name: fullName,
        email: dto.email.trim().toLowerCase(),
        phoneNumber: dto.phoneNumber.trim(),
        type: 'CONTACT',
        issueType,
        subject,
        message: dto.message,
        userId: linkedUserId,
        status: ContactStatus.PENDING,
      },
    });

    // Send confirmation email to user
    try {
      const emailSubject = `We received your message - Foreclosure Gold`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 8px; padding: 24px;">
          <h2 style="color: #0f3d63; border-bottom: 2px solid #0f3d63; padding-bottom: 8px; margin-top: 0;">Thank You for Contacting Us</h2>
          <p>Hi <strong>${dto.firstName}</strong>,</p>
          <p>We have received your message and a specialist will be in touch with you shortly.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #0f3d63; padding: 16px; margin: 18px 0; border-radius: 4px;">
            <p style="margin: 0 0 6px 0;"><strong>Name:</strong> ${fullName}</p>
            <p style="margin: 0 0 6px 0;"><strong>Email:</strong> ${dto.email}</p>
            <p style="margin: 0 0 6px 0;"><strong>Phone:</strong> ${dto.phoneNumber}</p>
            ${issueType ? `<p style="margin: 0 0 6px 0;"><strong>Interested In:</strong> ${issueType}</p>` : ''}
            <p style="margin: 0 0 6px 0;"><strong>Message:</strong></p>
            <p style="margin: 0; white-space: pre-wrap; font-style: italic;">"${dto.message}"</p>
          </div>

          <p style="color: #64748b; font-size: 13px;">
            A member of our team will be in touch with you shortly during normal business hours (Mon–Fri, 8am–6pm PST).
          </p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">
            Foreclosure Gold Team &copy; ${new Date().getFullYear()}. All rights reserved.
          </p>
        </div>
      `;
      await sendMailer(dto.email, emailSubject, emailHtml);
    } catch (err: any) {
      console.error(
        'Failed to send user contact confirmation email:',
        err?.message || err,
      );
    }

    // Notify admins
    try {
      if (this.notificationService) {
        await this.notificationService.notifyAdmins({
          title: 'New Contact Inquiry',
          message: `${result.name} sent a message regarding "${result.issueType || 'General'}".`,
          type: 'SUPPORT_REPLY',
          link: '/admin/support',
        });
      }
    } catch (err: any) {
      console.error(
        'Failed to notify admins of contact inquiry:',
        err?.message || err,
      );
    }

    return result;
  }

  /**
   * Solution 2: SUBMIT A SUPPORT REQUEST (Support Ticket)
   */
  async createSupportRequest(dto: CreateSupportRequestDto, userId?: string) {
    const message = dto.describeYourIssue || dto.message;
    if (!message || !message.trim()) {
      throw new BadRequestException('Please describe your issue');
    }

    const fullName = `${dto.firstName} ${dto.lastName}`.trim();
    const issueType = dto.issueType || null;
    const subject = issueType
      ? `Support Request: ${issueType}`
      : 'Support Request';

    // Verify user exists if userId was provided
    let linkedUserId: string | null = null;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user) {
        linkedUserId = user.id;
      }
    }

    const result = await this.prisma.contactUs.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        name: fullName,
        email: dto.email.trim().toLowerCase(),
        phoneNumber: dto.phoneNumber?.trim() || null,
        type: 'SUPPORT',
        issueType,
        subject,
        message: message.trim(),
        userId: linkedUserId,
        status: ContactStatus.PENDING,
      },
    });

    // Send confirmation email to user
    try {
      const emailSubject = `Support Request Received [Ticket #${result.id.slice(0, 8)}] - Foreclosure Gold`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 8px; padding: 24px;">
          <h2 style="color: #0f3d63; border-bottom: 2px solid #0f3d63; padding-bottom: 8px; margin-top: 0;">Support Request Received</h2>
          <p>Hi <strong>${dto.firstName}</strong>,</p>
          <p>We have received your support request. Our team takes pride in personal, attentive service and will respond promptly.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #0f3d63; padding: 16px; margin: 18px 0; border-radius: 4px;">
            <p style="margin: 0 0 6px 0;"><strong>Ticket ID:</strong> ${result.id}</p>
            <p style="margin: 0 0 6px 0;"><strong>Name:</strong> ${fullName}</p>
            <p style="margin: 0 0 6px 0;"><strong>Email:</strong> ${dto.email}</p>
            ${dto.phoneNumber ? `<p style="margin: 0 0 6px 0;"><strong>Phone:</strong> ${dto.phoneNumber}</p>` : ''}
            ${issueType ? `<p style="margin: 0 0 6px 0;"><strong>Issue Type:</strong> ${issueType}</p>` : ''}
            <p style="margin: 0 0 6px 0;"><strong>Issue Description:</strong></p>
            <p style="margin: 0; white-space: pre-wrap; font-style: italic;">"${message}"</p>
          </div>

          <p style="color: #64748b; font-size: 13px;">
            A member of our team will be in touch with you shortly during normal business hours (Mon–Fri, 8am–6pm PST).
          </p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">
            Foreclosure Gold Team &copy; ${new Date().getFullYear()}. All rights reserved.
          </p>
        </div>
      `;
      await sendMailer(dto.email, emailSubject, emailHtml);
    } catch (err: any) {
      console.error(
        'Failed to send user support confirmation email:',
        err?.message || err,
      );
    }

    // Notify admins
    try {
      if (this.notificationService) {
        await this.notificationService.notifyAdmins({
          title: 'New Support Request',
          message: `${result.name} submitted a support request: "${result.issueType || 'General'}".`,
          type: 'SUPPORT_REPLY',
          link: '/admin/support',
        });
      }
    } catch (err: any) {
      console.error(
        'Failed to notify admins of support request:',
        err?.message || err,
      );
    }

    return result;
  }

  /**
   * Unified Submission Endpoint (supports both CONTACT and SUPPORT)
   */
  async createContactUs(dto: CreateContactupDto, userId?: string) {
    let user: any = null;
    if (userId) {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
    }

    const type = dto.type?.toUpperCase() === 'SUPPORT' ? 'SUPPORT' : 'CONTACT';
    const message = dto.message || dto.describeYourIssue;
    if (!message || !message.trim()) {
      throw new BadRequestException('Message is required');
    }

    const firstName = dto.firstName || user?.firstName || '';
    const lastName = dto.lastName || user?.lastName || '';
    const fullName =
      dto.name || `${firstName} ${lastName}`.trim() || 'Anonymous User';
    const email = dto.email || user?.email;

    if (!email) {
      throw new BadRequestException('Email address is required');
    }

    const phoneNumber = dto.phoneNumber || user?.phoneNumber || null;
    const issueType = dto.issueType || dto.interestedIn || null;
    const subject =
      dto.subject ||
      (type === 'SUPPORT'
        ? `Support Request: ${issueType || 'General'}`
        : `Interested in ${issueType || 'General'}`);

    const result = await this.prisma.contactUs.create({
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        name: fullName,
        email: email.trim().toLowerCase(),
        phoneNumber,
        type,
        issueType,
        subject,
        message: message.trim(),
        userId: user?.id || null,
        status: ContactStatus.PENDING,
      },
    });

    // Notify admins
    try {
      if (this.notificationService) {
        await this.notificationService.notifyAdmins({
          title:
            type === 'SUPPORT' ? 'New Support Request' : 'New Contact Inquiry',
          message: `${result.name} submitted ${type === 'SUPPORT' ? 'a support request' : 'an inquiry'}: "${result.subject}".`,
          type: 'SUPPORT_REPLY',
          link: '/admin/support',
        });
      }
    } catch (err: any) {
      console.error('Failed to notify admins of inquiry:', err?.message || err);
    }

    return result;
  }

  /**
   * User API: Get user's submitted contact & support requests
   */
  async getMyContactUs(
    userId: string,
    params: IFilterParams,
    options: IOptions,
  ) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);

    const extraConditions: Record<string, any> = { userId };
    if (params.type) {
      extraConditions.type = String(params.type).toUpperCase();
      delete params.type;
    }
    if (params.status) {
      extraConditions.status = params.status;
      delete params.status;
    }

    const whenCondition = buildWhereConditions(
      params,
      ['subject', 'message', 'issueType'],
      extraConditions,
    );

    const [result, total] = await Promise.all([
      this.prisma.contactUs.findMany({
        where: whenCondition,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.contactUs.count({
        where: whenCondition,
      }),
    ]);

    return {
      data: result,
      meta: {
        total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      },
    };
  }

  /**
   * User API: Get single submitted request by ID
   */
  async getMyContactUsById(userId: string, id: string) {
    const result = await this.prisma.contactUs.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!result) {
      throw new NotFoundException('Inquiry not found');
    }

    return result;
  }

  /**
   * Admin API: Get all contact and support messages with filtering and pagination
   */
  async getAllContactUs(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);

    const extraConditions: Record<string, any> = {};

    if (params.type) {
      extraConditions.type = String(params.type).toUpperCase();
      delete params.type;
    }
    if (params.status) {
      extraConditions.status = params.status;
      delete params.status;
    }

    const whenCondition = buildWhereConditions(
      params,
      [
        'name',
        'firstName',
        'lastName',
        'email',
        'phoneNumber',
        'subject',
        'message',
        'issueType',
      ],
      extraConditions,
    );

    const [result, total] = await Promise.all([
      this.prisma.contactUs.findMany({
        where: whenCondition,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              photo: true,
            },
          },
        },
      }),
      this.prisma.contactUs.count({
        where: whenCondition,
      }),
    ]);

    return {
      data: result,
      meta: {
        total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin API: Get statistics & breakdown
   */
  async getStats() {
    const [
      total,
      pending,
      inProgress,
      resolved,
      closed,
      contactCount,
      supportCount,
    ] = await Promise.all([
      this.prisma.contactUs.count(),
      this.prisma.contactUs.count({
        where: { status: ContactStatus.PENDING },
      }),
      this.prisma.contactUs.count({
        where: { status: ContactStatus.IN_PROGRESS },
      }),
      this.prisma.contactUs.count({
        where: { status: ContactStatus.RESOLVED },
      }),
      this.prisma.contactUs.count({
        where: { status: ContactStatus.CLOSED },
      }),
      this.prisma.contactUs.count({
        where: { type: 'CONTACT' },
      }),
      this.prisma.contactUs.count({
        where: { type: 'SUPPORT' },
      }),
    ]);

    return {
      total,
      pending,
      inProgress,
      resolved,
      closed,
      contactCount,
      supportCount,
    };
  }

  /**
   * Admin API: Get single inquiry by ID
   */
  async getContactUsById(id: string) {
    const result = await this.prisma.contactUs.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            photo: true,
          },
        },
      },
    });

    if (!result) throw new NotFoundException('Contact message is not found');

    return result;
  }

  /**
   * Admin API: Update ticket status
   */
  async updateStatus(id: string, status: ContactStatus) {
    const contact = await this.prisma.contactUs.findUnique({
      where: { id },
    });
    if (!contact) throw new NotFoundException('Contact message is not found');

    const resolvedAt =
      status === ContactStatus.RESOLVED ? new Date() : contact.resolvedAt;

    const result = await this.prisma.contactUs.update({
      where: { id },
      data: {
        status,
        resolvedAt,
      },
    });

    return result;
  }

  /**
   * Update contact inquiry
   */
  async updatectConta(id: string, dto: UpdateContactupDto) {
    const contact = await this.prisma.contactUs.findUnique({
      where: { id },
    });
    if (!contact) throw new NotFoundException('Contact message is not found');

    const updateData: any = { ...dto };
    if (dto.status === ContactStatus.RESOLVED && !contact.resolvedAt) {
      updateData.resolvedAt = new Date();
    }

    const result = await this.prisma.contactUs.update({
      where: { id: contact.id },
      data: updateData,
    });

    return result;
  }

  /**
   * Admin API: Delete contact inquiry
   */
  async deleteContactUs(id: string) {
    const contact = await this.prisma.contactUs.findUnique({
      where: { id },
    });
    if (!contact) throw new NotFoundException('Contact message is not found');

    return this.prisma.contactUs.delete({
      where: { id },
    });
  }

  /**
   * Admin API: Reply to contact/support request and send email
   */
  async adminReply(id: string, dto: AdminReplyContactupDto) {
    const contact = await this.prisma.contactUs.findUnique({
      where: { id },
    });

    if (!contact) {
      throw new NotFoundException('Contact message is not found');
    }

    const updatedStatus = dto.status || ContactStatus.RESOLVED;
    const resolvedAt =
      updatedStatus === ContactStatus.RESOLVED
        ? new Date()
        : contact.resolvedAt;

    const result = await this.prisma.contactUs.update({
      where: { id: contact.id },
      data: {
        adminReply: dto.adminReply,
        status: updatedStatus,
        resolvedAt,
      },
    });

    if (dto.sendEmail !== false && contact.email) {
      try {
        const isSupport = contact.type === 'SUPPORT';
        const emailSubject = `Re: ${contact.subject || (isSupport ? 'Support Request' : 'Contact Message')} - Foreclosure Gold`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 8px; padding: 24px;">
            <h2 style="color: #0f3d63; border-bottom: 2px solid #0f3d63; padding-bottom: 8px; margin-top: 0;">Foreclosure Gold Support</h2>
            <p>Dear <strong>${contact.firstName || contact.name || 'User'}</strong>,</p>
            <p>Thank you for contacting our team. Here is our response to your ${isSupport ? 'support request' : 'inquiry'}:</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #0f3d63; padding: 16px; margin: 16px 0; border-radius: 4px;">
              <h4 style="margin: 0 0 8px 0; color: #0f3d63;">Our Response:</h4>
              <p style="margin: 0; white-space: pre-wrap;">${dto.adminReply}</p>
            </div>

            <div style="background-color: #f1f2f6; padding: 12px; margin: 16px 0; border-radius: 4px; font-size: 14px; color: #666;">
              <p style="margin: 0 0 4px 0;"><strong>Your Original Message:</strong></p>
              <p style="margin: 0; font-style: italic;">"${contact.message}"</p>
            </div>

            <p style="margin-top: 24px; font-size: 13px; color: #888;">
              Status: <span style="font-weight: bold; color: #27ae60;">${updatedStatus}</span>
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999; margin: 0;">
              Foreclosure Gold Team &copy; ${new Date().getFullYear()}. All rights reserved.
            </p>
          </div>
        `;

        await sendMailer(contact.email, emailSubject, emailHtml);
      } catch (err: any) {
        console.error('Failed to send admin reply email:', err?.message || err);
      }
    }

    if (contact.userId) {
      try {
        if (this.notificationService) {
          await this.notificationService.createNotification({
            userId: contact.userId,
            title: 'Support Inquiry Reply',
            message: `Admin replied to your ${contact.type === 'SUPPORT' ? 'support request' : 'inquiry'}: "${contact.subject}".`,
            type: 'SUPPORT_REPLY',
            link: '/dashboard/support',
          });
        }
      } catch (err: any) {
        console.error(
          'Failed to notify user of support reply:',
          err?.message || err,
        );
      }
    }

    return result;
  }
}

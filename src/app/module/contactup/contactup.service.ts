import { Injectable, NotFoundException } from '@nestjs/common';
import buildWhereConditions from 'src/app/helper/buildWhereConditions';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import sendMailer from 'src/app/helper/sendMailer';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminReplyContactupDto } from './dto/admin-reply-contactup.dto';
import { CreateContactupDto } from './dto/create-contactup.dto';
import { UpdateContactupDto } from './dto/update-contactup.dto';

@Injectable()
export class ContactupService {
  constructor(private readonly prisma: PrismaService) {}

  async createContactUs(userId: string, dto: CreateContactupDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) throw new NotFoundException('User is not found');

    const result = await this.prisma.contactUs.create({
      data: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
        phoneNumber: user.phoneNumber,
        subject: dto.subject,
        message: dto.message,
        userId: user.id,
      },
    });

    return result;
  }

  async getAllContactUs(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);

    const whenCondition = buildWhereConditions(params, [
      'name',
      'email',
      'subject',
      'message',
    ]);

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

  async getMyContactUs(
    userId: string,
    params: IFilterParams,
    options: IOptions,
  ) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);

    const whenCondition = buildWhereConditions(
      params,
      ['subject', 'message'],
      { userId },
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

  async getContactUsById(id: string) {
    const result = await this.prisma.contactUs.findUnique({
      where: {
        id,
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
    });

    if (!result) throw new NotFoundException('Contact message is not found');

    return result;
  }

  async updatectConta(id: string, dto: UpdateContactupDto) {
    const contact = await this.prisma.contactUs.findUnique({
      where: {
        id,
      },
    });
    if (!contact) throw new NotFoundException('Contact message is not found');

    const updateData: any = { ...dto };
    if (dto.status === 'RESOLVED' && !contact.resolvedAt) {
      updateData.resolvedAt = new Date();
    }

    const result = await this.prisma.contactUs.update({
      where: {
        id: contact.id,
      },
      data: updateData,
    });

    return result;
  }

  async deleteContactUs(id: string) {
    const contact = await this.prisma.contactUs.findUnique({
      where: { id },
    });
    if (!contact) throw new NotFoundException('Contact message is not found');

    return this.prisma.contactUs.delete({
      where: { id },
    });
  }

  async adminReply(id: string, dto: AdminReplyContactupDto) {
    const contact = await this.prisma.contactUs.findUnique({
      where: { id },
    });

    if (!contact) {
      throw new NotFoundException('Contact message is not found');
    }

    const updatedStatus = dto.status || 'RESOLVED';
    const resolvedAt =
      updatedStatus === 'RESOLVED' ? new Date() : contact.resolvedAt;

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
        const emailSubject = `Re: ${contact.subject || 'Support Ticket'} - Foreclosure Gold`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 8px; padding: 24px;">
            <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">Foreclosure Gold Support</h2>
            <p>Dear <strong>${contact.name || 'User'}</strong>,</p>
            <p>Thank you for contacting our support team. Here is our response to your inquiry:</p>
            
            <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 16px; margin: 16px 0; border-radius: 4px;">
              <h4 style="margin: 0 0 8px 0; color: #2c3e50;">Support Response:</h4>
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

    return result;
  }
}

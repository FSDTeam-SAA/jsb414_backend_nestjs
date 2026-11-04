import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../../prisma/prisma.service';
import config from '../../config';
import paginationHelper, { IOptions } from '../../helper/pagenation';
import { IFilterParams } from '../../helper/pick';
import { publicUserSelect } from '../../helper/public-user-select';
import sendMailer from '../../helper/sendMailer';
import { CreateAddAdminDto } from './dto/create-add-admin.dto';
import { UpdateAddAdminDto } from './dto/update-add-admin.dto';

@Injectable()
export class AddAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ১. সুপার অ্যাডমিন কর্তৃক নতুন সাব-অ্যাডমিন তৈরি ও ইমেইলে ক্রেডেনশিয়াল পাঠানো
  async create(dto: CreateAddAdminDto) {
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new HttpException(
        'A user or admin with this email already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    // পাসওয়ার্ড না দিলে স্বয়ংক্রিয় পাসওয়ার্ড জেনারেট করা
    const rawPassword =
      dto.password ||
      `FG#${Math.random().toString(36).slice(-6)}!${Math.floor(100 + Math.random() * 900)}`;

    const hashedPassword = await bcrypt.hash(
      rawPassword,
      config.bcryptSaltRounds,
    );

    const newAdmin = await this.prisma.user.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        phoneNumber: dto.phoneNumber?.trim() || null,
        password: hashedPassword,
        role: 'admin',
        verifiedEmail: true,
        permissions: dto.permissions,
      },
      select: publicUserSelect,
    });

    // ইমেইলে ক্রেডেনশিয়াল পাঠানো
    const frontendUrl =
      config.frontendUrl?.replace(/\/$/, '') || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/admin/login`;
    const permissionsHtml = dto.permissions
      .map(
        (perm) =>
          `<li style="margin: 4px 0;"><span style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-weight: bold; color: #2d3748;">${perm}</span></li>`,
      )
      .join('');

    const subject = 'Your Foreclosure Gold Admin Account Credentials';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; color: #2d3748;">
        <h2 style="color: #2b6cb0; margin-top: 0;">Foreclosure Gold Admin Access</h2>
        <p>Hello <strong>${dto.firstName} ${dto.lastName}</strong>,</p>
        <p>A Super Administrator has created an administrator account for you on the <strong>Foreclosure Gold</strong> portal.</p>

        <div style="background-color: #f7fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #3182ce; margin: 20px 0;">
          <p style="margin: 6px 0;"><strong>Portal Login URL:</strong> <a href="${loginUrl}" style="color: #3182ce;">${loginUrl}</a></p>
          <p style="margin: 6px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 6px 0;"><strong>Temporary Password:</strong> <code style="background: #edf2f7; padding: 3px 8px; border-radius: 4px; font-size: 14px; font-weight: bold; color: #c53030;">${rawPassword}</code></p>
        </div>

        <p style="margin-bottom: 8px;"><strong>Assigned Permissions:</strong></p>
        <ul style="list-style-type: none; padding-left: 0;">
          ${permissionsHtml}
        </ul>

        <p style="color: #718096; font-size: 13px; margin-top: 24px;">
          For security reasons, please log in and change your password immediately.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #a0aec0; font-size: 12px; margin-bottom: 0;">© ${new Date().getFullYear()} Foreclosure Gold. All rights reserved.</p>
      </div>
    `;

    try {
      await sendMailer(email, subject, html);
    } catch (err: any) {
      console.error(
        'Failed to send admin credentials email:',
        err?.message || err,
      );
    }

    return {
      message:
        'Admin account created successfully and credentials sent to email',
      admin: newAdmin,
    };
  }

  // ২. সকল সাব-অ্যাডমিনের তালিকা
  async findAll(params: IFilterParams, options: IOptions) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper(options);

    const andConditions: any[] = [{ role: 'admin' }];
    if (params.searchTerm) {
      andConditions.push({
        OR: [
          { firstName: { contains: params.searchTerm, mode: 'insensitive' } },
          { lastName: { contains: params.searchTerm, mode: 'insensitive' } },
          { email: { contains: params.searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    const where = { AND: andConditions };

    const [admins, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy || 'createdAt']: sortOrder || 'desc',
        },
        select: publicUserSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: admins,
    };
  }

  // ৩. একক সাব-অ্যাডমিনের বিবরণ
  async findOne(id: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });

    if (!admin || admin.role !== 'admin') {
      throw new HttpException('Admin user not found', HttpStatus.NOT_FOUND);
    }

    return admin;
  }

  // ৪. সাব-অ্যাডমিন তথ্য ও পারমিশন আপডেট
  async update(id: string, dto: UpdateAddAdminDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new HttpException('Admin user not found', HttpStatus.NOT_FOUND);
    }

    if (user.role !== 'admin') {
      throw new HttpException(
        'Only staff admins can be updated here',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updateData: Record<string, any> = {};
    if (dto.firstName) updateData.firstName = dto.firstName.trim();
    if (dto.lastName) updateData.lastName = dto.lastName.trim();
    if (dto.phoneNumber !== undefined) updateData.phoneNumber = dto.phoneNumber;
    if (dto.permissions) updateData.permissions = dto.permissions;

    if (dto.password) {
      updateData.password = await bcrypt.hash(
        dto.password,
        config.bcryptSaltRounds,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: publicUserSelect,
    });

    return {
      message: 'Admin updated successfully',
      data: updated,
    };
  }

  // ৫. সাব-অ্যাডমিন ডিলিট করা
  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new HttpException('Admin user not found', HttpStatus.NOT_FOUND);
    }

    if (user.role === 'superadmin') {
      throw new HttpException(
        'Superadmin accounts cannot be deleted',
        HttpStatus.FORBIDDEN,
      );
    }

    if (user.role !== 'admin') {
      throw new HttpException(
        'This user is not an admin',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return {
      message: 'Admin account removed successfully',
    };
  }
}

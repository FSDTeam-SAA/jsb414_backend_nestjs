import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import config from '../../config';
import buildWhereConditions from '../../helper/buildWhereConditions';
import { fileUpload } from '../../helper/fileUploder';
import paginationHelper, { IOptions } from '../../helper/pagenation';
import { IFilterParams } from '../../helper/pick';
import { publicUserSelect } from '../../helper/public-user-select';
import sendMailer from '../../helper/sendMailer';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateAdminDto, UpdateAdminPermissionsDto } from './dto/create-admin.dto';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { DeletionRequestQueryDto } from './dto/deletion-request-query.dto';
import { ReviewDeletionRequestDto } from './dto/review-deletion-request.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateInterestsDto } from './dto/update-interests.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationService?: NotificationService,
  ) {}

  async getAllUser(params: IFilterParams, options: IOptions) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper(options);
    const whenCondition = buildWhereConditions(params, [
      'firstName',
      'lastName',
      'email',
      'phoneNumber',
    ]);

    const now = new Date();
    const [result, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whenCondition,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        select: {
          ...publicUserSelect,
          walletBalance: true,
          userSubscribes: {
            where: {
              status: { in: ['ACTIVE', 'CANCELLED'] },
              startDate: { lte: now },
              endDate: { gt: now },
            },
            take: 1,
            orderBy: { endDate: 'desc' },
            include: {
              subscribe: {
                select: {
                  id: true,
                  title: true,
                  price: true,
                  discount: true,
                },
              },
            },
          },
          _count: {
            select: {
              userLead: true,
              orders: true,
              badLeadRequests: true,
            },
          },
        },
      }),
      this.prisma.user.count({
        where: whenCondition,
      }),
    ]);

    const formatted = result.map((u: any) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      email: u.email,
      phoneNumber: u.phoneNumber,
      photo: u.photo,
      role: u.role,
      verifiedEmail: u.verifiedEmail,
      walletBalance: Number(u.walletBalance || 0),
      membership: u.userSubscribes?.[0]?.subscribe?.title || 'Free',
      membershipPlanId: u.userSubscribes?.[0]?.subscribe?.id || null,
      membershipStatus: u.userSubscribes?.[0]?.status || 'ACTIVE',
      membershipExpiry: u.userSubscribes?.[0]?.endDate || null,
      totalPurchasedLeads: u._count?.userLead || 0,
      totalOrders: u._count?.orders || 0,
      totalBadLeadRequests: u._count?.badLeadRequests || 0,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return {
      data: formatted,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async getSingleUser(userId: string) {
    const now = new Date();

    const [user, activeSub] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          ...publicUserSelect,
          walletBalance: true,
        },
      }),
      this.prisma.userSubscribe.findFirst({
        where: {
          userId,
          status: { in: ['ACTIVE', 'CANCELLED'] },
          startDate: { lte: now },
          endDate: { gt: now },
        },
        orderBy: { endDate: 'desc' },
        include: {
          subscribe: {
            select: {
              id: true,
              title: true,
              subTitle: true,
              price: true,
              discount: true,
              currency: true,
            },
          },
        },
      }),
    ]);

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const activeSubscribe =
      activeSub && activeSub.subscribe
        ? {
            id: activeSub.id,
            subscribeId: activeSub.subscribe.id,
            title: activeSub.subscribe.title,
            planName: `${activeSub.subscribe.title} Member`,
            subTitle: activeSub.subscribe.subTitle,
            price: Number(activeSub.subscribe.price),
            discount: Number(activeSub.subscribe.discount || 0),
            currency: activeSub.subscribe.currency || 'USD',
            status: activeSub.status,
            startDate: activeSub.startDate,
            endDate: activeSub.endDate,
          }
        : null;

    return {
      ...user,
      walletBalance: Number(user.walletBalance || 0),
      activeSubscribe,
      activeSubscription: activeSubscribe,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (existingEmail) {
        throw new HttpException('Email already in use', HttpStatus.BAD_REQUEST);
      }
    }

    const updateData: Record<string, any> = {};
    if (updateUserDto.firstName) updateData.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName) updateData.lastName = updateUserDto.lastName;
    if (updateUserDto.email) updateData.email = updateUserDto.email;
    if (updateUserDto.phoneNumber !== undefined)
      updateData.phoneNumber = updateUserDto.phoneNumber;
    if (updateUserDto.photo) updateData.photo = updateUserDto.photo;

    const data = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: publicUserSelect,
    });
    return data;
  }

  async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto,
    file?: Express.Multer.File,
  ) {
    let photoUrl = updateUserDto.photo;

    if (file) {
      const uploadRes = await fileUpload.uploadToCloudinary(file);
      photoUrl = uploadRes.url;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (existingEmail) {
        throw new HttpException('Email already in use', HttpStatus.BAD_REQUEST);
      }
    }

    const updateData: Record<string, any> = {};
    if (updateUserDto.firstName) updateData.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName) updateData.lastName = updateUserDto.lastName;
    if (updateUserDto.email) updateData.email = updateUserDto.email;
    if (updateUserDto.phoneNumber !== undefined)
      updateData.phoneNumber = updateUserDto.phoneNumber;
    if (photoUrl) updateData.photo = photoUrl;

    const data = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: publicUserSelect,
    });
    return data;
  }

  async updateInterests(userId: string, dto: UpdateInterestsDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const data = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.leadTypes !== undefined && { leadTypes: dto.leadTypes }),
        ...(dto.interestedStates !== undefined && {
          interestedStates: dto.interestedStates,
        }),
        ...(dto.interestedCities !== undefined && {
          interestedCities: dto.interestedCities,
        }),
      },
      select: publicUserSelect,
    });

    return data;
  }

  // ১. সুপার অ্যাডমিন কর্তৃক নতুন সাব-অ্যাডমিন তৈরি ও ইমেইলে ক্রেডেনশিয়াল পাঠানো
  async createAdminBySuperAdmin(dto: CreateAdminDto) {
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

    // পাসওয়ার্ড না দিলে স্বয়ংক্রিয় নিরাপদ পাসওয়ার্ড তৈরি
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

  // ২. সুপার অ্যাডমিনের জন্য সকল সাব-অ্যাডমিনের তালিকা
  async getAllAdmins(params: IFilterParams, options: IOptions) {
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

  // ৩. সাব-অ্যাডমিনের পারমিশন আপডেট
  async updateAdminPermissions(id: string, dto: UpdateAdminPermissionsDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new HttpException('Admin user not found', HttpStatus.NOT_FOUND);
    }

    if (user.role !== 'admin') {
      throw new HttpException(
        'Only staff admins can have their permissions updated',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        permissions: dto.permissions,
      },
      select: publicUserSelect,
    });

    return {
      message: 'Admin permissions updated successfully',
      data: updated,
    };
  }

  // ৪. সাব-অ্যাডমিন ডিলিট করা
  async deleteAdmin(id: string) {
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

  // ৫. অ্যাডমিনের জন্য কাস্টমারের সম্পূর্ণ প্রোফাইল, মেম্বারশিপ, কেনা লিড, ফিনান্সিয়াল হিসাব ও ব্যাড লিড রিকোয়েস্ট (Section 43)
  async getCustomerDetails(customerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: {
        ...publicUserSelect,
        walletBalance: true,
      },
    });

    if (!user) {
      throw new HttpException('Customer not found', HttpStatus.NOT_FOUND);
    }

    const now = new Date();
    const [
      currentSub,
      purchasedLeads,
      totalPurchasedLeadsCount,
      completedOrders,
      savedSearchesCount,
      badLeads,
      recentOrders,
    ] = await Promise.all([
      // ১. বর্তমান সক্রিয় সাবস্ক্রিপশন প্ল্যান
      this.prisma.userSubscribe.findFirst({
        where: {
          userId: customerId,
          status: { in: ['ACTIVE', 'CANCELLED'] },
          startDate: { lte: now },
          endDate: { gt: now },
        },
        include: { subscribe: true },
        orderBy: { endDate: 'desc' },
      }),

      // ২. রিসেন্ট কেনা লিড (আনমাস্কড ফুল ইনফরমেশন)
      this.prisma.userLead.findMany({
        where: { userId: customerId },
        take: 10,
        orderBy: { purchasedAt: 'desc' },
        include: {
          lead: {
            include: {
              category: { select: { id: true, name: true } },
            },
          },
        },
      }),

      // ৩. সর্বমোট কেনা লিডের সংখ্যা
      this.prisma.userLead.count({ where: { userId: customerId } }),

      // ৪. ফিনান্সিয়াল অর্ডার এগ্রিগেশন (মোট খরচ ও মোট কমপ্লিটেড অর্ডার)
      this.prisma.order.aggregate({
        where: { userId: customerId, status: 'COMPLETED' },
        _count: { id: true },
        _sum: { totalAmount: true, walletUsed: true, cardPaid: true },
      }),

      // ৫. সেভড সার্চের সংখ্যা
      this.prisma.savedSearch.count({ where: { userId: customerId } }),

      // ৬. ব্যাড লিড রিকোয়েস্ট
      this.prisma.badLeadRequest.findMany({
        where: { userId: customerId },
        orderBy: { createdAt: 'desc' },
        include: {
          lead: {
            select: {
              id: true,
              leadNumber: true,
              propertyAddress: true,
              city: true,
              state: true,
            },
          },
        },
      }),

      // ৭. রিসেন্ট ৫টি অর্ডার
      this.prisma.order.findMany({
        where: { userId: customerId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      customer: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        phoneNumber: user.phoneNumber,
        photo: user.photo,
        role: user.role,
        verifiedEmail: user.verifiedEmail,
        leadTypes: user.leadTypes,
        interestedStates: user.interestedStates,
        interestedCities: user.interestedCities,
        registeredAt: user.createdAt,
      },
      membership: currentSub
        ? {
            planId: currentSub.subscribe.id,
            planName: currentSub.subscribe.title,
            price: currentSub.subscribe.price,
            discount: currentSub.subscribe.discount,
            status: currentSub.status,
            startDate: currentSub.startDate,
            renewalDate: currentSub.endDate,
          }
        : {
            planId: null,
            planName: 'Free',
            price: 0,
            discount: 0,
            status: 'ACTIVE',
            startDate: null,
            renewalDate: null,
          },
      financials: {
        walletBalance: Number(user.walletBalance || 0),
        totalOrders: completedOrders._count.id || 0,
        totalSpent: Number(completedOrders._sum.totalAmount || 0),
        walletSpent: Number(completedOrders._sum.walletUsed || 0),
        cardSpent: Number(completedOrders._sum.cardPaid || 0),
      },
      leadsActivity: {
        totalPurchasedLeads: totalPurchasedLeadsCount,
        savedSearchesCount,
        recentPurchasedLeads: purchasedLeads.map((ul) => ({
          id: ul.id,
          leadId: ul.leadId,
          leadNumber: ul.lead.leadNumber,
          category: ul.lead.category?.name,
          propertyAddress: ul.lead.propertyAddress,
          city: ul.lead.city,
          state: ul.lead.state,
          zipcode: ul.lead.zipcode,
          phoneNumbers: ul.lead.phoneNumbers,
          emailAddresses: ul.lead.emailAddresses,
          priceType: ul.priceType,
          pricePaid: Number(ul.pricePaid),
          purchasedAt: ul.purchasedAt,
        })),
        badLeadRequests: badLeads.map((bl) => ({
          id: bl.id,
          leadId: bl.leadId,
          leadNumber: bl.lead.leadNumber,
          leadLocation: `${bl.lead.city || ''}, ${bl.lead.state || ''}`.trim(),
          reason: bl.reason,
          explanation: bl.explanation,
          status: bl.status,
          creditReturned: bl.creditReturned ? Number(bl.creditReturned) : null,
          adminNotes: bl.adminNotes,
          createdAt: bl.createdAt,
          reviewedAt: bl.reviewedAt,
        })),
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalAmount: Number(o.totalAmount),
        status: o.status,
        createdAt: o.createdAt,
      })),
    };
  }

  // কাস্টমার সেলফ-সার্ভিস অ্যাকাউন্ট ডিলিট বা ডিঅ্যাক্টিভেশন
  async deleteUserAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // ১. পাসওয়ার্ড ভেরিফাই করা
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new HttpException(
        'Incorrect password. Account deletion aborted.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // ২. কোনো অ্যাক্টিভ স্ট্রাইপ সাবস্ক্রিপশন থাকলে তা ক্যানসেল করা
    const activeSub = await this.prisma.userSubscribe.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    if (activeSub) {
      if (activeSub.stripeSubscriptionId && config.stripe.secretKey) {
        try {
          const stripe = new Stripe(config.stripe.secretKey);
          await stripe.subscriptions.cancel(activeSub.stripeSubscriptionId);
        } catch (e: any) {
          console.error(
            'Failed to cancel stripe subscription during account deletion:',
            e?.message || e,
          );
        }
      }
      await this.prisma.userSubscribe.update({
        where: { id: activeSub.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    }

    // ৩. কার্ট ও সেভড সার্চ ক্লিন করা
    await Promise.all([
      this.prisma.cartItem.deleteMany({ where: { userId } }),
      this.prisma.savedSearch.deleteMany({ where: { userId } }),
    ]);

    // ৪. ইউজারের কোনো ফিন্যান্সিয়াল অর্ডার বা পেমেন্ট হিস্ট্রি আছে কি না
    const [orderCount, paymentCount] = await Promise.all([
      this.prisma.order.count({ where: { userId } }),
      this.prisma.payment.count({ where: { userId } }),
    ]);

    if (orderCount === 0 && paymentCount === 0) {
      // ফিন্যান্সিয়াল হিস্ট্রি নেই - সম্পূর্ণ ডিলিট করা
      await this.prisma.user.delete({ where: { id: userId } });
      return {
        message: 'Your account and personal data have been permanently deleted.',
        deleted: true,
      };
    }

    // ফিন্যান্সিয়াল ও অডিট রেকর্ড অটুট রাখতে ব্যক্তিগত তথ্য অ্যানোনিমাইজ করা
    const anonymizedEmail = `deleted_${userId.substring(0, 8)}_${Date.now()}@anonymized.user`;
    const dummyPassword = await bcrypt.hash(Math.random().toString(36), 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: 'Deactivated',
        lastName: 'Account',
        email: anonymizedEmail,
        phoneNumber: null,
        photo: null,
        password: dummyPassword,
        verifiedEmail: false,
        walletBalance: 0,
        leadTypes: [],
        interestedStates: [],
        interestedCities: [],
      },
    });

    return {
      message:
        'Your account has been deactivated and your personal details have been safely anonymized in compliance with data privacy regulations.',
      deactivated: true,
    };
  }

  // Helper: একাউন্ট নিরাপদভাবে পার্মানেন্ট ডিলিট অথবা অডিট-সংরক্ষণে অ্যানোনিমাইজ করা
  async anonymizeOrDeleteUser(userId: string) {
    const activeSub = await this.prisma.userSubscribe.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    if (activeSub) {
      if (activeSub.stripeSubscriptionId && config.stripe.secretKey) {
        try {
          const stripe = new Stripe(config.stripe.secretKey);
          await stripe.subscriptions.cancel(activeSub.stripeSubscriptionId);
        } catch (e: any) {
          console.error(
            'Failed to cancel stripe subscription during account deletion:',
            e?.message || e,
          );
        }
      }
      await this.prisma.userSubscribe.update({
        where: { id: activeSub.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    }

    await Promise.all([
      this.prisma.cartItem.deleteMany({ where: { userId } }),
      this.prisma.savedSearch.deleteMany({ where: { userId } }),
    ]);

    const [orderCount, paymentCount] = await Promise.all([
      this.prisma.order.count({ where: { userId } }),
      this.prisma.payment.count({ where: { userId } }),
    ]);

    if (orderCount === 0 && paymentCount === 0) {
      await this.prisma.user.delete({ where: { id: userId } });
      return { deleted: true };
    }

    const anonymizedEmail = `deleted_${userId.substring(0, 8)}_${Date.now()}@anonymized.user`;
    const dummyPassword = await bcrypt.hash(Math.random().toString(36), 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: 'Deactivated',
        lastName: 'Account',
        email: anonymizedEmail,
        phoneNumber: null,
        photo: null,
        password: dummyPassword,
        verifiedEmail: false,
        walletBalance: 0,
        leadTypes: [],
        interestedStates: [],
        interestedCities: [],
      },
    });

    return { deactivated: true };
  }

  // কাস্টমার অ্যাকাউন্ট ডিলিটেশন রিকোয়েস্ট সাবমিট করা (Figma: Reason Submission)
  async submitDeletionRequest(userId: string, dto: CreateDeletionRequestDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingPending = await this.prisma.deletionRequest.findFirst({
      where: {
        userId,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      throw new BadRequestException(
        'You already have an account deletion request pending review.',
      );
    }

    const request = await this.prisma.deletionRequest.create({
      data: {
        userId,
        reason: dto.reason,
        status: 'PENDING',
      },
    });

    if (this.notificationService) {
      try {
        await this.notificationService.createNotification({
          userId,
          title: 'Account Deletion Request Submitted',
          message:
            'Your account deletion request has been submitted and is currently being reviewed by the administration.',
          type: 'ACCOUNT_DELETION',
          link: '/dashboard',
        });
      } catch (err: any) {
        console.error('Failed to send notification for deletion request:', err?.message || err);
      }
    }

    return {
      message: 'Account deletion request submitted successfully',
      data: request,
    };
  }

  // কাস্টমার তার সাম্প্রতিক ডিলিটেশন রিকোয়েস্ট স্ট্যাটাস দেখা
  async getMyDeletionRequest(userId: string) {
    const request = await this.prisma.deletionRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      hasRequest: !!request,
      isPending: request?.status === 'PENDING',
      data: request || null,
    };
  }

  // অ্যাডমিন: সকল ডিলিটেশন রিকোয়েস্ট তালিকা দেখা (Figma Screen: Deletion Requests Table)
  async getAllDeletionRequestsAdmin(query: DeletionRequestQueryDto) {
    const {
      searchTerm,
      status,
      page = 1,
      limit = 25,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (searchTerm) {
      where.OR = [
        { reason: { contains: searchTerm, mode: 'insensitive' } },
        { user: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const now = new Date();
    const [requests, total] = await Promise.all([
      this.prisma.deletionRequest.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              photo: true,
              createdAt: true,
              updatedAt: true,
              userSubscribes: {
                where: {
                  status: { in: ['ACTIVE', 'CANCELLED'] },
                  startDate: { lte: now },
                  endDate: { gt: now },
                },
                orderBy: { endDate: 'desc' },
                take: 1,
                include: {
                  subscribe: {
                    select: { title: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.deletionRequest.count({ where }),
    ]);

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const formatted = requests.map((r) => {
      const u = r.user;
      const fullName = u
        ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
        : 'Deleted User';
      const customerId = u
        ? `FG-C-${u.id.replace(/-/g, '').slice(0, 5).toUpperCase()}`
        : 'N/A';
      const membership = u?.userSubscribes?.[0]?.subscribe?.title || 'Free';
      const d = new Date(r.createdAt);
      const dateFormatted = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;

      return {
        id: r.id,
        customerName: fullName,
        customerId,
        email: u?.email || 'N/A',
        membership,
        date: dateFormatted,
        rawDate: r.createdAt,
        status: r.status,
        reason: r.reason,
        adminNotes: r.adminNotes,
      };
    });

    return {
      data: formatted,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPage: Math.ceil(total / Number(limit)) || 1,
      },
    };
  }

  // অ্যাডমিন: ডিলিটেশন রিকোয়েস্ট বিস্তারিত মডাল (Figma Screen: Deletion Request Details Modal)
  async getSingleDeletionRequestAdmin(id: string) {
    const now = new Date();
    const request = await this.prisma.deletionRequest.findUnique({
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
            role: true,
            createdAt: true,
            updatedAt: true,
            userSubscribes: {
              where: {
                status: { in: ['ACTIVE', 'CANCELLED'] },
                startDate: { lte: now },
                endDate: { gt: now },
              },
              orderBy: { endDate: 'desc' },
              take: 1,
              include: {
                subscribe: {
                  select: { title: true },
                },
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Deletion request not found');
    }

    const u = request.user;
    const fullName = u
      ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
      : 'Deleted User';
    const customerId = u
      ? `FG-C-${u.id.replace(/-/g, '').slice(0, 5).toUpperCase()}`
      : 'N/A';
    const membership = u?.userSubscribes?.[0]?.subscribe?.title || 'Free';

    const initials = u
      ? `${(u.firstName || '')[0] || ''}${(u.lastName || '')[0] || ''}`.toUpperCase()
      : 'U';

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const joinD = u ? new Date(u.createdAt) : new Date();
    const joinDateFormatted = `${joinD.getDate()} ${monthNames[joinD.getMonth()]} ${joinD.getFullYear()}`;

    const updatedD = u ? new Date(u.updatedAt) : new Date();
    const diffDays = Math.floor(
      (now.getTime() - updatedD.getTime()) / (1000 * 3600 * 24),
    );
    const lastLoginFormatted =
      diffDays === 0
        ? 'Today'
        : diffDays === 1
          ? '1 day ago'
          : `${diffDays} days ago`;

    return {
      id: request.id,
      customer: {
        id: u?.id || null,
        name: fullName,
        initials,
        status: u?.role === 'user' ? 'Active' : 'Staff',
        customerId,
        membership,
        phoneNumber: u?.phoneNumber || 'N/A',
        email: u?.email || 'N/A',
        joinDate: joinDateFormatted,
        lastLogin: lastLoginFormatted,
        photo: u?.photo || null,
      },
      reason: request.reason,
      status: request.status,
      adminNotes: request.adminNotes,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
      reviewedById: request.reviewedById,
    };
  }

  // অ্যাডমিন: ডিলিটেশন রিকোয়েস্ট পর্যালোচনা (Figma: Approved বা Deny বাটন)
  async reviewDeletionRequest(
    id: string,
    reviewerId: string,
    dto: ReviewDeletionRequestDto,
  ) {
    const request = await this.prisma.deletionRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Deletion request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `This deletion request has already been ${request.status.toLowerCase()}`,
      );
    }

    const now = new Date();

    if (dto.status === 'APPROVED') {
      await this.anonymizeOrDeleteUser(request.userId);

      const updated = await this.prisma.deletionRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          adminNotes: dto.adminNotes || null,
          reviewedAt: now,
          reviewedById: reviewerId,
        },
      });

      return {
        message:
          'Deletion request approved. Customer account has been successfully deactivated and data anonymized.',
        data: updated,
      };
    } else {
      const updated = await this.prisma.deletionRequest.update({
        where: { id },
        data: {
          status: 'DENIED',
          adminNotes: dto.adminNotes || null,
          reviewedAt: now,
          reviewedById: reviewerId,
        },
      });

      if (this.notificationService) {
        try {
          await this.notificationService.createNotification({
            userId: request.userId,
            title: 'Account Deletion Request Denied',
            message: dto.adminNotes
              ? `Your account deletion request was reviewed and denied. Reason: ${dto.adminNotes}`
              : 'Your account deletion request was reviewed and denied by administration.',
            type: 'ACCOUNT_DELETION',
            link: '/dashboard',
          });
        } catch (err: any) {
          console.error('Failed to notify user about denied deletion request:', err?.message || err);
        }
      }

      return {
        message: 'Deletion request denied successfully.',
        data: updated,
      };
    }
  }
}

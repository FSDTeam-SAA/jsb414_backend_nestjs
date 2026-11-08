import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  calculateDynamicLeadPrice,
  inventoryAge,
} from '../../helper/pricing.helper';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // ১. কাস্টমার ড্যাশবোর্ড ওভারভিউ (Figma Frame 2147236215: Dashboard Overview)
  // =========================================================================
  async userDashboardOverview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        photo: true,
        role: true,
        walletBalance: true,
        leadTypes: true,
        interestedStates: true,
        interestedCities: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();

    // সব ডাটা দ্রুত লোড করার জন্য প্যারালাল কোয়েরি এক্সিকিউশন
    const [
      activeSubscription,
      purchasedLeadsCount,
      exclusivePurchasedCount,
      sharedPurchasedCount,
      cartItemsCount,
      savedSearchesCount,
      unreadNotificationsCount,
      badLeadStats,
      recentPurchasedLeads,
      recentOrders,
      globalAgePriceRules,
      recommendedLeadsRaw,
    ] = await Promise.all([
      // ১. বর্তমান অ্যাক্টিভ মেম্বারশিপ প্ল্যান
      this.prisma.userSubscribe.findFirst({
        where: {
          userId: user.id,
          status: { in: ['ACTIVE', 'CANCELLED'] },
          startDate: { lte: now },
          endDate: { gt: now },
        },
        orderBy: { endDate: 'desc' },
        include: {
          subscribe: true,
        },
      }),

      // ২. কেনা লিডের মোট সংখ্যা ও ধরন
      this.prisma.userLead.count({
        where: { userId: user.id },
      }),
      this.prisma.userLead.count({
        where: { userId: user.id, priceType: 'EXCLUSIVE' },
      }),
      this.prisma.userLead.count({
        where: { userId: user.id, priceType: 'SHARED' },
      }),

      // ৩. কার্টের আইটেম সংখ্যা
      this.prisma.cartItem.count({
        where: { userId: user.id },
      }),

      // ৪. সেভ করা সার্চের সংখ্যা
      this.prisma.savedSearch.count({
        where: { userId: user.id },
      }),

      // ৫. অপঠিত নোটিফিকেশনের সংখ্যা (🔔 বেল আইকন ব্যাজ)
      this.prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),

      // ৬. ব্যাড লিড রিকোয়েস্ট স্ট্যাটাস কাউন্ট
      this.prisma.badLeadRequest.groupBy({
        by: ['status'],
        where: { userId: user.id },
        _count: { _all: true },
      }),

      // ৭. সম্প্রতি কেনা লিডের তালিকা (সর্বশেষ ৫টি)
      this.prisma.userLead.findMany({
        where: { userId: user.id },
        take: 5,
        orderBy: { purchasedAt: 'desc' },
        include: {
          lead: {
            select: {
              id: true,
              leadNumber: true,
              propertyAddress: true,
              unitNumber: true,
              city: true,
              state: true,
              zipcode: true,
              propertyType: true,
              category: { select: { id: true, name: true } },
              phoneNumbers: true,
              emailAddresses: true,
            },
          },
        },
      }),

      // ৮. সাম্প্রতিক অর্ডার ইতিহাস (সর্বশেষ ৫টি)
      this.prisma.order.findMany({
        where: { userId: user.id },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          _count: { select: { orderItems: true } },
        },
      }),

      // ৯. ডায়নামিক প্রাইসিং রুলস
      this.prisma.agePriceRule.findMany({
        orderBy: { minDays: 'asc' },
      }),

      // ১০. ড্যাশবোর্ডের মার্কেটপ্লেস প্রিভিউ সেকশনের জন্য প্রস্তাবিত লিড (সর্বশেষ ৬টি)
      this.prisma.lead.findMany({
        where: {
          status: 'ACTIVE',
          classification: 'SELLABLE',
          category: { isActive: true },
          exclusiveSoldAt: null,
          userLead: { none: { userId: user.id } },
          ...(user.leadTypes && user.leadTypes.length > 0
            ? { category: { name: { in: user.leadTypes }, isActive: true } }
            : {}),
          ...(user.interestedStates && user.interestedStates.length > 0
            ? { state: { in: user.interestedStates } }
            : {}),
        },
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              sharedBasePrice: true,
              exclusiveBasePrice: true,
              agePricingEnabled: true,
            },
          },
        },
      }),
    ]);

    // মেম্বারশিপ ডিসকাউন্ট
    const membershipDiscount = activeSubscription?.subscribe?.discount
      ? Number(activeSubscription.subscribe.discount)
      : 0;

    const membership = activeSubscription
      ? {
          planId: activeSubscription.subscribe.id,
          planName: activeSubscription.subscribe.title,
          subTitle: activeSubscription.subscribe.subTitle,
          price: Number(activeSubscription.subscribe.price),
          discountPercentage: membershipDiscount,
          status: activeSubscription.status,
          startDate: activeSubscription.startDate,
          endDate: activeSubscription.endDate,
          isFree: false,
        }
      : {
          planId: null,
          planName: 'Free Plan',
          subTitle: 'Basic Access',
          price: 0,
          discountPercentage: 0,
          status: 'ACTIVE',
          startDate: null,
          endDate: null,
          isFree: true,
        };

    // ব্যাড লিড স্ট্যাটাস সামারি
    const badLeadCounts = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    for (const item of badLeadStats) {
      badLeadCounts.total += item._count._all;
      if (item.status === 'PENDING') badLeadCounts.pending += item._count._all;
      if (item.status === 'APPROVED')
        badLeadCounts.approved += item._count._all;
      if (item.status === 'REJECTED')
        badLeadCounts.rejected += item._count._all;
    }

    // প্রস্তাবিত লিডের ডায়নামিক প্রাইস এবং মাস্কড কন্টাক্ট ডেটা
    const recommendedLeads = recommendedLeadsRaw.map((lead) => {
      const prices = calculateDynamicLeadPrice({
        categorySharedBasePrice: lead.category.sharedBasePrice,
        categoryExclusiveBasePrice: lead.category.exclusiveBasePrice,
        agePricingEnabled: lead.category.agePricingEnabled,
        agePriceRules: globalAgePriceRules,
        ageInDays: inventoryAge(lead.createdAt),
        userDiscountPercent: membershipDiscount,
      });

      return {
        id: lead.id,
        leadNumber: lead.leadNumber,
        category: {
          id: lead.category.id,
          name: lead.category.name,
        },
        propertyAddress: lead.propertyAddress,
        unitNumber: lead.unitNumber,
        city: lead.city,
        state: lead.state,
        zipcode: lead.zipcode,
        propertyType: lead.propertyType,
        availability: lead.availability,
        estValue: lead.estValue,
        estEquity: lead.estEquity,
        mortgageBalance: lead.mortgageBalance,
        saleDate: lead.saleDate,
        stage: lead.stage,
        phoneCount: lead.phoneNumbers?.length || 0,
        emailCount: lead.emailAddresses?.length || 0,
        hasContactInfo:
          (lead.phoneNumbers?.length || 0) > 0 ||
          (lead.emailAddresses?.length || 0) > 0,
        sharedPrice:
          lead.availability === 'EXCLUSIVE' ||
          (lead.sharedLimit !== null &&
            lead.sharedSalesCount >= lead.sharedLimit)
            ? null
            : prices.finalShared,
        exclusivePrice:
          lead.availability === 'SHARED' ? null : prices.finalExclusive,
        currency: 'USD',
        appliedDiscountPercent: membershipDiscount,
        createdAt: lead.createdAt,
      };
    });

    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
        phoneNumber: user.phoneNumber,
        photo: user.photo,
        role: user.role,
        leadTypes: user.leadTypes,
        interestedStates: user.interestedStates,
        interestedCities: user.interestedCities,
        memberSince: user.createdAt,
      },
      // ৩টি টপ কার্ড (Figma Frame 2147236215):
      overviewCards: {
        membership,
        leads: {
          totalPurchased: purchasedLeadsCount,
          exclusiveCount: exclusivePurchasedCount,
          sharedCount: sharedPurchasedCount,
        },
        accountBalance: {
          currentBalance: Number(user.walletBalance || 0),
          currency: 'USD',
          quickTopUpOptions: [100, 250, 500],
        },
      },
      // দ্রুত কাউন্টার ব্যাজ
      counters: {
        cartItemsCount,
        savedSearchesCount,
        unreadNotificationsCount,
        badLeadRequests: badLeadCounts,
      },
      // সাম্প্রতিক কেনা লিড
      recentPurchasedLeads: recentPurchasedLeads.map((ul) => ({
        id: ul.id,
        leadId: ul.leadId,
        leadNumber: ul.lead?.leadNumber,
        category: ul.lead?.category?.name,
        propertyAddress: ul.lead?.propertyAddress,
        unitNumber: ul.lead?.unitNumber,
        city: ul.lead?.city,
        state: ul.lead?.state,
        zipcode: ul.lead?.zipcode,
        priceType: ul.priceType,
        pricePaid: Number(ul.pricePaid),
        purchasedAt: ul.purchasedAt,
        phoneNumbers: ul.lead?.phoneNumbers || [],
        emailAddresses: ul.lead?.emailAddresses || [],
      })),
      // সাম্প্রতিক অর্ডার
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalAmount: Number(o.totalAmount),
        status: o.status,
        itemsCount: o._count.orderItems,
        createdAt: o.createdAt,
      })),
      // মার্কেটপ্লেস প্রিভিউ প্রস্তাবিত লিড
      recommendedLeads,
    };
  }

  // =========================================================================
  // ২. অ্যাডমিন ড্যাশবোর্ড ওভারভিউ (Admin Dashboard Overview)
  // =========================================================================
  async adminDashboardOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalCustomers,
      totalAdmins,
      newUsersThisMonth,
      totalLeads,
      sellableLeads,
      exclusiveSoldLeads,
      totalOrders,
      completedOrdersAgg,
      pendingBadLeadRequests,
      recentOrders,
      recentUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'user' } }),
      this.prisma.user.count({
        where: { role: { in: ['admin', 'superadmin'] } },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.lead.count(),
      this.prisma.lead.count({
        where: { status: 'ACTIVE', classification: 'SELLABLE' },
      }),
      this.prisma.lead.count({ where: { exclusiveSoldAt: { not: null } } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalAmount: true, walletUsed: true, cardPaid: true },
        _count: { id: true },
      }),
      this.prisma.badLeadRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: { select: { orderItems: true } },
        },
      }),
      this.prisma.user.findMany({
        where: { role: 'user' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          photo: true,
          walletBalance: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        customers: totalCustomers,
        admins: totalAdmins,
        newThisMonth: newUsersThisMonth,
      },
      leads: {
        total: totalLeads,
        sellable: sellableLeads,
        exclusiveSold: exclusiveSoldLeads,
      },
      financials: {
        totalOrders,
        completedOrders: completedOrdersAgg._count.id || 0,
        totalRevenue: Number(completedOrdersAgg._sum.totalAmount || 0),
        walletRevenue: Number(completedOrdersAgg._sum.walletUsed || 0),
        cardRevenue: Number(completedOrdersAgg._sum.cardPaid || 0),
      },
      pendingBadLeadRequests,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName:
          `${o.user.firstName || ''} ${o.user.lastName || ''}`.trim(),
        customerEmail: o.user.email,
        totalAmount: Number(o.totalAmount),
        status: o.status,
        itemsCount: o._count.orderItems,
        createdAt: o.createdAt,
      })),
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        fullName: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        email: u.email,
        photo: u.photo,
        walletBalance: Number(u.walletBalance || 0),
        joinedAt: u.createdAt,
      })),
    };
  }
}

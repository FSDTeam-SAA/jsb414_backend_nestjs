import { PrismaService } from '../../../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService (Figma Frame 2147236436)', () => {
  let service: ReportsService;
  let db: any;

  beforeEach(() => {
    db = {
      order: {
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      payment: {
        aggregate: jest.fn(),
      },
      userLead: {
        count: jest.fn(),
      },
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      catagorie: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      orderItem: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      lead: {
        findUnique: jest.fn(),
      },
    };

    service = new ReportsService(db as PrismaService);
  });

  describe('getReportsSummary', () => {
    it('calculates summary cards, donut breakdown, and category breakdown matching Figma', async () => {
      db.order.aggregate.mockResolvedValueOnce({
        _sum: { totalAmount: 28599 },
        _count: { id: 450 },
      });
      db.payment.aggregate.mockResolvedValueOnce({
        _sum: { amount: 50250 },
        _count: { id: 510 },
      });
      db.userLead.count.mockResolvedValueOnce(1264);
      db.user.count.mockResolvedValueOnce(3500);

      db.catagorie.findMany.mockResolvedValueOnce([
        { id: 'cat_1', name: 'Pre-Foreclosure' },
      ]);
      db.orderItem.aggregate.mockResolvedValueOnce({
        _sum: { pricePaid: 15000 },
        _count: { id: 600 },
      });

      const result = await service.getReportsSummary({ period: 'month' });

      expect(result.summaryCards.totalRevenue).toBe(78849);
      expect(result.summaryCards.leadRevenue).toBe(28599);
      expect(result.summaryCards.subscriptionRevenue).toBe(50250);
      expect(result.summaryCards.totalLeadsSold).toBe(1264);
      expect(result.summaryCards.totalOrders).toBe(450);
      expect(result.summaryCards.averageOrderValue).toBe(63.55);

      expect(result.revenueBreakdown.totalRevenue).toBe(78849);
      expect(result.revenueBreakdown.subscription.amount).toBe(50250);
      expect(result.revenueBreakdown.leadSales.amount).toBe(28599);

      expect(result.revenueByCategory.length).toBe(1);
      expect(result.revenueByCategory[0].categoryName).toBe('Pre-Foreclosure');
      expect(result.revenueByCategory[0].revenue).toBe(15000);
    });
  });

  describe('getRevenueTrend', () => {
    it('returns monthly trend for the selected year', async () => {
      db.order.aggregate.mockResolvedValue({
        _sum: { totalAmount: 1000 },
        _count: { id: 20 },
      });
      db.payment.aggregate.mockResolvedValue({
        _sum: { amount: 2000 },
        _count: { id: 30 },
      });

      const result = await service.getRevenueTrend({ timeline: 'monthly', year: 2026 });

      expect(result.year).toBe(2026);
      expect(result.trend.length).toBe(12);
      expect(result.trend[0].period).toBe('Jan');
      expect(result.trend[0].totalRevenue).toBe(3000);
      expect(result.trend[0].subscriptionRevenue).toBe(2000);
      expect(result.trend[0].leadRevenue).toBe(1000);
    });
  });

  describe('getTopCustomers', () => {
    it('returns top customers ordered by total spent', async () => {
      db.user.findMany.mockResolvedValueOnce([
        {
          id: 'u_100',
          firstName: 'John',
          lastName: 'Bhawal',
          email: 'johnbhawal@gmail.com',
          phoneNumber: '+345 345 2353',
          photo: null,
          createdAt: new Date(),
          userSubscribes: [{ subscribe: { title: 'Gold' } }],
          orders: [{ totalAmount: 500 }, { totalAmount: 300 }],
          _count: { orders: 2, userLead: 15 },
        },
      ]);
      db.user.count.mockResolvedValueOnce(1);

      const result = await service.getTopCustomers({ limit: 10 });

      expect(result.data.length).toBe(1);
      expect(result.data[0].customerName).toBe('John Bhawal');
      expect(result.data[0].customerId).toContain('FG-C-');
      expect(result.data[0].totalSpent).toBe(800);
      expect(result.data[0].membership).toBe('Gold');
      expect(result.data[0].totalOrders).toBe(2);
      expect(result.data[0].totalPurchasedLeads).toBe(15);
    });
  });

  describe('getCategoryPerformance', () => {
    it('returns inventory and sales stats per category', async () => {
      db.catagorie.findMany.mockResolvedValueOnce([
        {
          id: 'cat_1',
          name: 'Probate',
          _count: { leads: 120 },
        },
      ]);
      db.catagorie.count.mockResolvedValueOnce(1);
      db.orderItem.count
        .mockResolvedValueOnce(30) // shared
        .mockResolvedValueOnce(10); // exclusive
      db.orderItem.aggregate.mockResolvedValueOnce({
        _sum: { pricePaid: 2500 },
      });

      const result = await service.getCategoryPerformance({ limit: 10 });

      expect(result.data.length).toBe(1);
      expect(result.data[0].categoryName).toBe('Probate');
      expect(result.data[0].inventoryCount).toBe(120);
      expect(result.data[0].sharedSales).toBe(30);
      expect(result.data[0].exclusiveSales).toBe(10);
      expect(result.data[0].totalLeadsSold).toBe(40);
      expect(result.data[0].totalRevenue).toBe(2500);
    });
  });

  describe('getSharedVsExclusive (Figma Image 1)', () => {
    it('calculates shared vs exclusive revenue metrics and split percentages', async () => {
      db.orderItem.count
        .mockResolvedValueOnce(380) // shared
        .mockResolvedValueOnce(620); // exclusive
      db.orderItem.aggregate
        .mockResolvedValueOnce({ _sum: { pricePaid: 14620 } }) // shared
        .mockResolvedValueOnce({ _sum: { pricePaid: 23920 } }); // exclusive

      const result = await service.getSharedVsExclusive({ viewBy: 'revenue' });

      expect(result.viewBy).toBe('revenue');
      expect(result.sharedLeads.amount).toBe(14620);
      expect(result.exclusiveLeads.amount).toBe(23920);
      expect(result.progressBar.sharedPercentage).toBe(38);
      expect(result.progressBar.exclusivePercentage).toBe(62);
      expect(result.sharedLeads.subtext).toContain('38% of total revenue');
    });

    it('calculates leads sold split when viewBy is leadsSold', async () => {
      db.orderItem.count
        .mockResolvedValueOnce(40) // shared
        .mockResolvedValueOnce(60); // exclusive
      db.orderItem.aggregate
        .mockResolvedValueOnce({ _sum: { pricePaid: 1000 } })
        .mockResolvedValueOnce({ _sum: { pricePaid: 2000 } });

      const result = await service.getSharedVsExclusive({ viewBy: 'leadsSold' });

      expect(result.viewBy).toBe('leadsSold');
      expect(result.sharedLeads.leadsSold).toBe(40);
      expect(result.exclusiveLeads.leadsSold).toBe(60);
      expect(result.progressBar.sharedPercentage).toBe(40);
      expect(result.progressBar.exclusivePercentage).toBe(60);
    });
  });

  describe('getCategorySalesTable (Figma Image 2)', () => {
    it('returns formatted category sales records matching Figma table columns', async () => {
      db.orderItem.findMany.mockResolvedValueOnce([
        {
          id: 'item_1',
          orderId: 'ord_1',
          leadId: 'lead_1',
          priceType: 'SHARED',
          pricePaid: 25.0,
          createdAt: new Date(),
          lead: {
            propertyType: 'Single Family',
            category: { id: 'c_1', name: 'Foreclosure' },
          },
          order: {
            id: 'ord_1',
            orderNumber: 'FG-ORD-10284',
            user: { firstName: 'Md', lastName: 'Jillu', email: 'jillu@test.com' },
          },
        },
      ]);
      db.orderItem.count.mockResolvedValueOnce(1);

      const result = await service.getCategorySalesTable({ page: 1, limit: 25 });

      expect(result.data.length).toBe(1);
      const row = result.data[0];
      expect(row.orderId).toBe('FG-ORD-10284');
      expect(row.leadType).toBe('Foreclosure');
      expect(row.customerName).toBe('Md Jillu');
      expect(row.propertyType).toBe('Single Family');
      expect(row.availability).toBe('Shared');
      expect(row.price).toBe(25);
      expect(row.priceFormatted).toBe('$25.00');
    });
  });

  describe('getLocationSalesTable (Figma Image 3)', () => {
    it('returns formatted location sales records matching Figma table columns', async () => {
      db.orderItem.findMany.mockResolvedValueOnce([
        {
          id: 'item_2',
          orderId: 'ord_2',
          leadId: 'lead_2',
          priceType: 'EXCLUSIVE',
          pricePaid: 40.0,
          createdAt: new Date(),
          lead: {
            state: 'Florida',
            city: 'Miami',
            propertyType: 'Multi-Family',
            category: { id: 'c_2', name: 'Foreclosure' },
          },
          order: {
            id: 'ord_2',
            orderNumber: 'FG-ORD-10284',
            user: { firstName: 'Md', lastName: 'Jillu', email: 'jillu@test.com' },
          },
        },
      ]);
      db.orderItem.count.mockResolvedValueOnce(1);

      const result = await service.getLocationSalesTable({ page: 1, limit: 25 });

      expect(result.data.length).toBe(1);
      const row = result.data[0];
      expect(row.location).toBe('Florida');
      expect(row.orderId).toBe('FG-ORD-10284');
      expect(row.leadType).toBe('Foreclosure');
      expect(row.customerName).toBe('Md Jillu');
      expect(row.propertyType).toBe('Multi-Family');
      expect(row.availability).toBe('Exclusive');
      expect(row.price).toBe(40);
      expect(row.priceFormatted).toBe('$40.00');
    });
  });

  describe('getReportItemDetails (Figma View Report Modal)', () => {
    it('returns complete modal data matching Figma View Report modal popup', async () => {
      db.orderItem.findUnique.mockResolvedValueOnce({
        id: 'item_1',
        orderId: 'ord_1',
        leadId: 'lead_1',
        priceType: 'EXCLUSIVE',
        pricePaid: 25.0,
        createdAt: new Date('2026-10-05'),
        lead: {
          id: 'lead_1',
          leadNumber: 20481,
          firstName: 'Michael',
          lastName: 'Anderson',
          propertyAddress: '1240 Oak Avenue',
          city: 'Orange',
          state: 'CA',
          zipcode: '92866',
          propertyType: 'Single family',
          propertyImage: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7',
          phoneNumbers: ['(714) 555-0142'],
          emailAddresses: ['anderson@example.com'],
          saleDate: new Date('2026-11-12'),
          category: { id: 'c_1', name: 'Pre-Foreclosure' },
        },
        order: {
          id: 'ord_1',
          orderNumber: 'FG-ORD-10284',
          status: 'COMPLETED',
          user: {
            id: 'u_1',
            firstName: 'Md',
            lastName: 'Jillu',
            email: 'john@example.com',
          },
        },
      });

      const result = await service.getReportItemDetails('item_1');

      expect(result.customer.name).toBe('Md Jillu');
      expect(result.customer.email).toBe('john@example.com');
      expect(result.customer.paymentStatus).toBe('Paid');
      expect(result.customer.orderId).toBe('FG-ORD-10284');
      expect(result.contactInformation.name).toBe('Michael Anderson');
      expect(result.contactInformation.phone).toBe('(714) 555-0142');
      expect(result.contactInformation.email).toBe('anderson@example.com');
      expect(result.addresses.propertyAddress).toContain('1240 Oak Avenue, Orange, CA 92866');
      expect(result.leadInformation.leadType).toBe('Pre-Foreclosure');
      expect(result.leadInformation.leadId).toBe('FG-LD-20481');
      expect(result.purchaseInformation.access).toBe('Exclusive');
      expect(result.purchaseInformation.order).toBe('FG-ORD-10284');
    });
  });
});

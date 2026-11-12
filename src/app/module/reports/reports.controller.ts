import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard } from '../../middlewares/auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../middlewares/permissions.guard';
import {
  CategorySalesTableQueryDto,
  ExportReportDto,
  LocationSalesTableQueryDto,
  ReportsPaginationDto,
  ReportsSummaryQueryDto,
  RevenueTrendQueryDto,
  SharedVsExclusiveQueryDto,
} from './dto/reports-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('Admin Reports')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
@RequirePermissions('DASHBOARD')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Get overall reports overview cards & revenue breakdown (Figma Frame 2147236436)',
    description:
      'Returns 5 summary metrics cards (Total Revenue, Subscription Revenue, Lead Revenue, Total Leads Sold, Total Orders), Donut chart revenue breakdown, and Category breakdown.',
  })
  @HttpCode(HttpStatus.OK)
  async getReportsSummary(@Query() query: ReportsSummaryQueryDto) {
    const result = await this.reportsService.getReportsSummary(query);
    return {
      message: 'Reports summary fetched successfully',
      data: result,
    };
  }

  @Get('revenue-trend')
  @ApiOperation({
    summary:
      'Get timeline revenue trend multi-line chart data (Figma: Revenue Trend Chart)',
    description:
      'Returns monthly revenue progression comparing Total Revenue, Subscription Revenue, and Lead Sales Revenue.',
  })
  @HttpCode(HttpStatus.OK)
  async getRevenueTrend(@Query() query: RevenueTrendQueryDto) {
    const result = await this.reportsService.getRevenueTrend(query);
    return {
      message: 'Revenue trend data fetched successfully',
      data: result,
    };
  }

  @Get('top-customers')
  @ApiOperation({
    summary:
      'Get top performing customers table by revenue spent (Figma: Top Customers Table)',
    description:
      'Returns paginated list of customers sorted by total spending with customerId, membership, orders count, and purchased leads count.',
  })
  @HttpCode(HttpStatus.OK)
  async getTopCustomers(@Query() query: ReportsPaginationDto) {
    const result = await this.reportsService.getTopCustomers(query);
    return {
      message: 'Top customers fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get('category-performance')
  @ApiOperation({
    summary:
      'Get category sales & inventory performance table (Figma: Top Performing Categories)',
    description:
      'Returns lead inventory count, total leads sold, exclusive sales, shared sales, and total revenue per lead category.',
  })
  @HttpCode(HttpStatus.OK)
  async getCategoryPerformance(@Query() query: ReportsPaginationDto) {
    const result = await this.reportsService.getCategoryPerformance(query);
    return {
      message: 'Category performance fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get('export')
  @ApiOperation({
    summary:
      'Export report data to clean CSV spreadsheet (Figma: Export Report)',
    description:
      'Streams a downloadable CSV file for summary metrics, revenue trend, top customers, or category performance.',
  })
  async exportReport(@Query() query: ExportReportDto, @Res() res: Response) {
    return this.reportsService.exportReportCsv(query, res);
  }

  // =========================================================================
  // ৬. Figma Image 1: Revenue by Lead Category (Shared vs Exclusive Cards & Split Bar)
  // =========================================================================
  @Get('shared-vs-exclusive')
  @ApiOperation({
    summary:
      'Get Shared vs Exclusive leads revenue & leads sold split (Figma Image 1)',
    description:
      'Returns metrics for Shared Leads and Exclusive Leads with amounts, percentages, and progress bar split. Toggleable by viewBy=revenue or viewBy=leadsSold.',
  })
  @HttpCode(HttpStatus.OK)
  async getSharedVsExclusive(@Query() query: SharedVsExclusiveQueryDto) {
    const result = await this.reportsService.getSharedVsExclusive(query);
    return {
      message: 'Shared vs Exclusive report metrics fetched successfully',
      data: result,
    };
  }

  // =========================================================================
  // ৭. Figma Image 2: Revenue by Lead Category (Table View)
  // =========================================================================
  @Get('category-sales-table')
  @ApiOperation({
    summary:
      'Get Revenue by Lead Category sales table with search & pagination (Figma Image 2)',
    description:
      'Table columns: Order ID, Lead Type, Customer Name, Property Type, Leads sold, Availability, Price, Action.',
  })
  @HttpCode(HttpStatus.OK)
  async getCategorySalesTable(@Query() query: CategorySalesTableQueryDto) {
    const result = await this.reportsService.getCategorySalesTable(query);
    return {
      message: 'Category sales table records fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  // =========================================================================
  // ৮. Figma Image 3: Revenue by Location (Table View)
  // =========================================================================
  @Get('location-sales-table')
  @ApiOperation({
    summary:
      'Get Revenue by Location sales table with search & pagination (Figma Image 3)',
    description:
      'Table columns: Location, Lead Type, Customer Name, Property Type, Leads sold, Availability, Price, Action.',
  })
  @HttpCode(HttpStatus.OK)
  async getLocationSalesTable(@Query() query: LocationSalesTableQueryDto) {
    const result = await this.reportsService.getLocationSalesTable(query);
    return {
      message: 'Location sales table records fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  // =========================================================================
  // ৯. Figma View Report Modal Details (Revenue by Lead Category & Revenue by Location)
  // =========================================================================
  @Get('report-details/:id')
  @ApiOperation({
    summary:
      'Get single report item modal details by orderItemId or leadId (Figma: View Report Modal)',
    description:
      'Returns complete customer, property, contact info, lead info, and purchase info matching Figma View Report modal popup.',
  })
  @HttpCode(HttpStatus.OK)
  async getReportItemDetails(@Param('id') id: string) {
    const result = await this.reportsService.getReportItemDetails(id);
    return {
      message: 'Report item details fetched successfully',
      data: result,
    };
  }

  @Get('order-item-report/:id')
  @ApiOperation({
    summary:
      'Alias for report-details/:id - Get report item modal details (Figma: View Report Modal)',
  })
  @HttpCode(HttpStatus.OK)
  async getOrderItemReportAlias(@Param('id') id: string) {
    const result = await this.reportsService.getReportItemDetails(id);
    return {
      message: 'Report item details fetched successfully',
      data: result,
    };
  }
}

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../../middlewares/auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // =========================================================================
  // ১. ইউজার ড্যাশবোর্ড ওভারভিউ (Customer Dashboard Overview)
  // =========================================================================

  @Get('user-overview')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get customer dashboard overview',
  })
  @HttpCode(HttpStatus.OK)
  async userDashboardOverview(@Req() req: Request) {
    const userId = req.user!.id;
    const result = await this.dashboardService.userDashboardOverview(userId);
    return {
      message: 'User dashboard overview fetched successfully',
      data: result,
    };
  }

  // // Alias endpoint: /dashboard/overview
  // @Get('overview')
  // @UseGuards(AuthGuard())
  // @ApiBearerAuth('access-token')
  // @ApiOperation({
  //   summary: 'Get customer dashboard overview (Alias for /user-overview)',
  // })
  // @HttpCode(HttpStatus.OK)
  // async getOverview(@Req() req: Request) {
  //   const userId = req.user!.id;
  //   const result = await this.dashboardService.userDashboardOverview(userId);
  //   return {
  //     message: 'User dashboard overview fetched successfully',
  //     data: result,
  //   };
  // }

  // =========================================================================
  // ২. অ্যাডমিন ড্যাশবোর্ড ওভারভিউ (Admin Dashboard Overview)
  // =========================================================================

  @Get('admin-overview')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Get admin dashboard overview (Total users, Leads breakdown, Platform revenue, Orders, Bad lead requests, & Recent activity)',
  })
  @HttpCode(HttpStatus.OK)
  async adminDashboardOverview() {
    const result = await this.dashboardService.adminDashboardOverview();
    return {
      message: 'Admin dashboard overview fetched successfully',
      data: result,
    };
  }
}

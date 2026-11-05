import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../../middlewares/auth.guard';
import { NotificationQueryDto } from './dto/notification-query.dto';
import {
  BroadcastNotificationDto,
  SendNotificationDto,
} from './dto/send-notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // =========================================================================
  // ইউজার এন্ডপয়েন্ট (User Endpoints)
  // =========================================================================

  @Get('unread-count')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get total unread notifications count for header bell icon badge',
  })
  @HttpCode(HttpStatus.OK)
  async getUnreadCount(@Req() req: Request) {
    const userId = req.user!.id;
    const result = await this.notificationService.getUnreadCount(userId);
    return {
      message: 'Unread notifications count fetched successfully',
      data: result,
    };
  }

  @Get()
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current user notifications with pagination and filtering',
  })
  @HttpCode(HttpStatus.OK)
  async getMyNotifications(
    @Req() req: Request,
    @Query() query: NotificationQueryDto,
  ) {
    const userId = req.user!.id;
    const result = await this.notificationService.getMyNotifications(
      userId,
      query,
    );
    return {
      message: 'Notifications fetched successfully',
      meta: result.meta,
      unreadCount: result.unreadCount,
      data: result.data,
    };
  }

  @Patch('read-all')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@Req() req: Request) {
    const userId = req.user!.id;
    const result = await this.notificationService.markAllAsRead(userId);
    return result;
  }

  @Patch(':id/read')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user!.id;
    const result = await this.notificationService.markAsRead(userId, id);
    return result;
  }

  @Delete('clear-read')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete all read notifications for current user' })
  @HttpCode(HttpStatus.OK)
  async clearAllRead(@Req() req: Request) {
    const userId = req.user!.id;
    const result = await this.notificationService.clearAllRead(userId);
    return result;
  }

  @Delete(':id')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a single notification' })
  @HttpCode(HttpStatus.OK)
  async deleteNotification(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user!.id;
    const result = await this.notificationService.deleteNotification(
      userId,
      id,
    );
    return result;
  }

  // =========================================================================
  // অ্যাডমিন এন্ডপয়েন্ট (Admin Endpoints)
  // =========================================================================

  @Post('send')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Send a direct notification to a specific user (Admin)',
  })
  @HttpCode(HttpStatus.CREATED)
  async sendDirectNotification(@Body() dto: SendNotificationDto) {
    const result = await this.notificationService.sendDirectNotification(dto);
    return result;
  }

  @Post('broadcast')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Broadcast a notification to all registered users (Admin)',
  })
  @HttpCode(HttpStatus.CREATED)
  async broadcastNotification(@Body() dto: BroadcastNotificationDto) {
    const result = await this.notificationService.broadcastNotification(dto);
    return result;
  }
}

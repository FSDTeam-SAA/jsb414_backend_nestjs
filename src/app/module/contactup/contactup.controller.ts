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
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import pick from 'src/app/helper/pick';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from 'src/app/middlewares/permissions.guard';
import { ContactupService } from './contactup.service';
import { AdminReplyContactupDto } from './dto/admin-reply-contactup.dto';
import { CreateContactupDto } from './dto/create-contactup.dto';
import { UpdateContactupDto } from './dto/update-contactup.dto';

@ApiTags('Contact Us')
@Controller('contact-us')
export class ContactupController {
  constructor(private readonly contactupService: ContactupService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard())
  @ApiOperation({ summary: 'Submit a new contact / support message' })
  @HttpCode(HttpStatus.CREATED)
  async createContactUs(@Req() req: Request, @Body() dto: CreateContactupDto) {
    const userId = req.user!.id;
    const result = await this.contactupService.createContactUs(userId, dto);
    return {
      message: 'Contact message submitted successfully',
      data: result,
    };
  }

  @Get('my')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard())
  @ApiOperation({ summary: 'Get my submitted contact messages' })
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  @HttpCode(HttpStatus.OK)
  async getMyContactUs(@Req() req: Request) {
    const userId = req.user!.id;
    const filters = pick(req.query, ['searchTerm', 'status', 'subject']);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.contactupService.getMyContactUs(
      userId,
      filters,
      options,
    );
    return {
      message: 'My contact messages fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('SUPPORT')
  @ApiOperation({
    summary: 'Get all contact messages with filtering and pagination (Admin)',
  })
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  @HttpCode(HttpStatus.OK)
  async getAllContactUs(@Req() req: Request) {
    const filters = pick(req.query, [
      'searchTerm',
      'status',
      'subject',
      'email',
      'name',
    ]);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.contactupService.getAllContactUs(
      filters,
      options,
    );
    return {
      message: 'All contact messages fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('SUPPORT')
  @ApiOperation({ summary: 'Get contact message by id (Admin)' })
  @HttpCode(HttpStatus.OK)
  async getContactUsById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.contactupService.getContactUsById(id);
    return {
      message: 'Contact message fetched successfully',
      data: result,
    };
  }

  @Post(':id/reply')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('SUPPORT')
  @ApiOperation({
    summary: 'Admin reply to a contact / support message',
    description:
      'Saves the admin reply, updates status (default: RESOLVED), and sends an email notification to the user.',
  })
  @HttpCode(HttpStatus.OK)
  async adminReply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminReplyContactupDto,
  ) {
    const result = await this.contactupService.adminReply(id, dto);
    return {
      message: 'Admin reply sent successfully',
      data: result,
    };
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user'))
  @ApiOperation({ summary: 'Update contact message' })
  @HttpCode(HttpStatus.OK)
  async updateContactUs(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactupDto,
  ) {
    const result = await this.contactupService.updatectConta(id, dto);
    return {
      message: 'Contact message updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('SUPPORT')
  @ApiOperation({ summary: 'Delete contact message (Admin)' })
  @HttpCode(HttpStatus.OK)
  async deleteContactUs(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.contactupService.deleteContactUs(id);
    return {
      message: 'Contact message deleted successfully',
      data: result,
    };
  }
}

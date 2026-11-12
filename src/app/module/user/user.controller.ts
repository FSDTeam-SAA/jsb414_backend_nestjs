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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { fileUpload } from '../../helper/fileUploder';
import pick from '../../helper/pick';
import { AuthGuard } from '../../middlewares/auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../middlewares/permissions.guard';
import { CreateAdminDto, UpdateAdminPermissionsDto } from './dto/create-admin.dto';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { DeletionRequestQueryDto } from './dto/deletion-request-query.dto';
import { ReviewDeletionRequestDto } from './dto/review-deletion-request.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { UserService } from './user.service';
import { UserQueryDto } from './dto/user-query.dto';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({
    summary: 'get all user',
  })
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('CUSTOMERS')
  @ApiBearerAuth('access-token')
  @ApiQuery({
    name: 'searchTerm',
    type: String,
    required: false,
    description: 'search term',
  })
  @ApiQuery({
    name: 'role',
    type: String,
    required: false,
    description: 'filter by role (user, admin, superadmin)',
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'page number',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'limit per page',
  })
  @ApiQuery({
    name: 'sortBy',
    type: String,
    required: false,
    description: 'sort by field',
  })
  @ApiQuery({
    name: 'sortOrder',
    type: String,
    required: false,
    description: 'sort order (asc or desc)',
  })
  @HttpCode(HttpStatus.OK)
  async getAllUser(@Query() query: UserQueryDto) {
    const filters = pick(query, ['searchTerm', 'role']);
    const options = pick(query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.userService.getAllUser(filters, options);

    return {
      message: 'get all user successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get('profile')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'get current user profile with active subscription (or null if none)',
    description:
      'Returns current authenticated user profile, walletBalance, and activeSubscribe details (null if user has no active subscription).',
  })
  @HttpCode(HttpStatus.OK)
  async getProfile(@Req() req: Request) {
    const userId = req.user!.id;
    const result = await this.userService.getSingleUser(userId);

    return {
      message: 'get profile successfully',
      data: result,
    };
  }

  @Patch('profile')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @UseInterceptors(FileInterceptor('photo', fileUpload.uploadConfig))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'update current user profile (with optional photo)',
  })
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: Request,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user!.id;
    const result = await this.userService.updateProfile(
      userId,
      updateUserDto,
      file,
    );

    return {
      message: 'profile updated successfully',
      data: result,
    };
  }

  @Patch('interests')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update user lead interests (Figma: What leads interest you?)',
  })
  @HttpCode(HttpStatus.OK)
  async updateInterests(
    @Req() req: Request,
    @Body() dto: UpdateInterestsDto,
  ) {
    const userId = req.user!.id;
    const result = await this.userService.updateInterests(userId, dto);

    return {
      message: 'Interests saved successfully',
      data: result,
    };
  }

    @Delete('account')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete or deactivate current user account with password confirmation',
    description:
      'Verifies password, cancels active subscription, deletes cart/saved searches, and deletes or anonymizes account history.',
  })
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@Req() req: Request, @Body() dto: DeleteAccountDto) {
    const userId = req.user!.id;
    const result = await this.userService.deleteUserAccount(userId, dto);
    return result;
  }

  
  @Post('deletion-request')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Submit account deletion request with reason (Customer)',
    description: 'Submits a deletion request for admin review (Figma: Reason box submission).',
  })
  @HttpCode(HttpStatus.CREATED)
  async submitDeletionRequest(
    @Req() req: Request,
    @Body() dto: CreateDeletionRequestDto,
  ) {
    const userId = req.user!.id;
    const result = await this.userService.submitDeletionRequest(userId, dto);
    return result;
  }

  @Get('deletion-request')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current user deletion request status (Customer)',
    description: 'Checks if current user has an active/pending deletion request under review.',
  })
  @HttpCode(HttpStatus.OK)
  async getMyDeletionRequest(@Req() req: Request) {
    const userId = req.user!.id;
    const result = await this.userService.getMyDeletionRequest(userId);
    return {
      message: 'Deletion request status fetched successfully',
      data: result,
    };
  }

  // =========================================================================
  // সাব-অ্যাডমিন রোল ও পারমিশন ম্যানেজমেন্ট (শুধুমাত্র Super Admin)
  // =========================================================================

  @Post('admin/create-admin')
  @UseGuards(AuthGuard('superadmin'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Super Admin creates a new staff admin with roles/permissions and emails credentials',
  })
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(@Body() dto: CreateAdminDto) {
    const result = await this.userService.createAdminBySuperAdmin(dto);
    return {
      message: result.message,
      data: result.admin,
    };
  }

  @Get('admin/admins')
  @UseGuards(AuthGuard('superadmin'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Super Admin gets all staff admins with their assigned permissions',
  })
  @HttpCode(HttpStatus.OK)
  async getAllAdmins(@Query() query: UserQueryDto) {
    const filters = pick(query, ['searchTerm']);
    const options = pick(query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.userService.getAllAdmins(filters, options);

    return {
      message: 'Staff admins fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Patch('admin/:id/permissions')
  @UseGuards(AuthGuard('superadmin'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Super Admin updates permissions of a staff admin',
  })
  @HttpCode(HttpStatus.OK)
  async updateAdminPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminPermissionsDto,
  ) {
    const result = await this.userService.updateAdminPermissions(id, dto);
    return result;
  }

  @Delete('admin/:id')
  @UseGuards(AuthGuard('superadmin'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Super Admin removes a staff admin',
  })
  @HttpCode(HttpStatus.OK)
  async deleteAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.deleteAdmin(id);
  }

  
  // =========================================================================
  // একাউন্ট ডিলিটেশন রিকোয়েস্ট ম্যানেজমেন্ট (Figma: Deletion Requests)
  // =========================================================================

  @Get('admin/deletion-requests')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('CUSTOMERS')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get all account deletion requests for admin table (Figma Screen)',
    description:
      'Fetches paginated list of deletion requests with customer name, customerId, email, membership, date, and status.',
  })
  @HttpCode(HttpStatus.OK)
  async getAllDeletionRequestsAdmin(@Query() query: DeletionRequestQueryDto) {
    const result = await this.userService.getAllDeletionRequestsAdmin(query);
    return {
      message: 'Deletion requests fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get('admin/deletion-requests/:id')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('CUSTOMERS')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get single deletion request details for modal (Figma Screen Modal)',
    description:
      'Fetches customer profile, avatar initials, membership, phone, email, join date, last login, and submitted reason.',
  })
  @HttpCode(HttpStatus.OK)
  async getSingleDeletionRequestAdmin(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.userService.getSingleDeletionRequestAdmin(id);
    return {
      message: 'Deletion request details fetched successfully',
      data: result,
    };
  }

  @Patch('admin/deletion-requests/:id/review')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('CUSTOMERS')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Review deletion request - Approve or Deny (Figma Buttons)',
    description:
      'Admin approves (processes account deactivation/deletion) or denies (notifies user with reason) the deletion request.',
  })
  @HttpCode(HttpStatus.OK)
  async reviewDeletionRequest(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDeletionRequestDto,
  ) {
    const reviewerId = req.user!.id;
    const result = await this.userService.reviewDeletionRequest(
      id,
      reviewerId,
      dto,
    );
    return result;
  }

  // =========================================================================
  // কাস্টমার ম্যানেজমেন্ট: একক কাস্টমারের সম্পূর্ণ বিবরণ (Section 43)
  // =========================================================================

  @Get('customer/:id')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('CUSTOMERS')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Admin gets full customer details: profile, active membership, purchased leads, financial summary, and bad lead requests (Section 43)',
  })
  @HttpCode(HttpStatus.OK)
  async getCustomerDetails(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.userService.getCustomerDetails(id);
    return {
      message: 'Customer details fetched successfully',
      data: result,
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'get single user by id (Admin)',
  })
  @HttpCode(HttpStatus.OK)
  async getSingleUser(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.userService.getSingleUser(id);

    return {
      message: 'get single user successfully',
      data: result,
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard('admin', 'superadmin'), PermissionsGuard)
  @RequirePermissions('CUSTOMERS')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'update user by id (Admin)',
  })
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const result = await this.userService.update(id, updateUserDto);

    return {
      message: 'user updated successfully',
      data: result,
    };
  }
}

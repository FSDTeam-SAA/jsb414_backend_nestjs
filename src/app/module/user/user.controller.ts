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

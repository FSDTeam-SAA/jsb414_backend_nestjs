import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { UpdateUserDto } from './dto/update-user.dto';
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
  @UseGuards(AuthGuard('admin', 'superadmin'))
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
    description: 'role',
  })
  @ApiQuery({
    name: 'email',
    type: String,
    required: false,
    description: 'email',
  })
  @ApiQuery({
    name: 'firstName',
    type: String,
    required: false,
    description: 'firstName',
  })
  @ApiQuery({
    name: 'lastName',
    type: String,
    required: false,
    description: 'lastName',
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
    description: 'limit number',
  })
  @ApiQuery({
    name: 'sortBy',
    type: String,
    required: false,
    description: 'sort by',
  })
  @ApiQuery({
    name: 'sortOrder',
    type: String,
    required: false,
    description: 'sort order',
  })
  @HttpCode(HttpStatus.OK)
  async getAllUser(@Query() query: UserQueryDto) {
    const filters = pick(query, [
      'searchTerm',
      'role',
      'firstName',
      'lastName',
      'email',
      'phoneNumber',
    ]);
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
    summary: 'get current user profile',
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
  @UseGuards(AuthGuard('admin', 'superadmin'))
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

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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import pick from '../../helper/pick';
import { AuthGuard } from '../../middlewares/auth.guard';
import { UserQueryDto } from '../user/dto/user-query.dto';
import { AddAdminService } from './add-admin.service';
import { CreateAddAdminDto } from './dto/create-add-admin.dto';
import { UpdateAddAdminDto } from './dto/update-add-admin.dto';

@ApiTags('Super Admin - Manage Admins')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('superadmin')) // শুধুমাত্র Super Admin সাব-অ্যাডমিন তৈরি ও ম্যানেজ করতে পারবে
@Controller('add-admin')
export class AddAdminController {
  constructor(private readonly addAdminService: AddAdminService) {}

  @Post()
  @ApiOperation({
    summary:
      'Super Admin creates a new staff admin with roles/permissions and emails credentials',
  })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAddAdminDto: CreateAddAdminDto) {
    const result = await this.addAdminService.create(createAddAdminDto);
    return {
      message: result.message,
      data: result.admin,
    };
  }

  @Get()
  @ApiOperation({
    summary:
      'Super Admin gets all staff admins with their assigned permissions',
  })
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: UserQueryDto) {
    const filters = pick(query, ['searchTerm']);
    const options = pick(query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.addAdminService.findAll(filters, options);

    return {
      message: 'Staff admins fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Super Admin gets a single staff admin by ID',
  })
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.addAdminService.findOne(id);
    return {
      message: 'Admin details fetched successfully',
      data: result,
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Super Admin updates permissions or profile of a staff admin',
  })
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAddAdminDto: UpdateAddAdminDto,
  ) {
    return this.addAdminService.update(id, updateAddAdminDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Super Admin removes a staff admin',
  })
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.addAdminService.remove(id);
  }
}

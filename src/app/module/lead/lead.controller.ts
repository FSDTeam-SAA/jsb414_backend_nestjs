import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import { fileUpload } from 'src/app/helper/fileUploder';
import pick from 'src/app/helper/pick';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { BulkUploadLeadDto } from './dto/bulk-upload-lead.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadService } from './lead.service';

@ApiTags('Leads')
@Controller('lead')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Create a new lead with optional property image',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @UseInterceptors(FileInterceptor('propertyImage', fileUpload.uploadConfig))
  @HttpCode(HttpStatus.CREATED)
  async createLead(
    @Req() req: Request,
    @Body() createLeadDto: CreateLeadDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const adminId = req.user!.id;
    const result = await this.leadService.createLead(
      createLeadDto,
      adminId,
      file,
    );

    return {
      message: 'Lead created successfully',
      data: result,
    };
  }

  @Post('bulk-upload')
  @ApiOperation({
    summary: 'Bulk upload leads from CSV or Excel (.xlsx, .xls) file',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @UseInterceptors(
    FileInterceptor('file', fileUpload.documentUploadConfig),
  )
  @HttpCode(HttpStatus.CREATED)
  async bulkUploadLeads(
    @Req() req: Request,
    @Body() bulkUploadLeadDto: BulkUploadLeadDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const adminId = req.user!.id;
    const result = await this.leadService.bulkUploadLeads(
      file,
      adminId,
      bulkUploadLeadDto.defaultCategoryId,
    );

    return {
      message: `Bulk import completed: ${result.importedCount} lead(s) imported`,
      data: result,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all leads with filtering and pagination',
  })
  @ApiQuery({ name: 'searchTerm', required: false, type: 'string' })
  @ApiQuery({ name: 'categoryId', required: false, type: 'string' })
  @ApiQuery({ name: 'city', required: false, type: 'string' })
  @ApiQuery({ name: 'state', required: false, type: 'string' })
  @ApiQuery({ name: 'status', required: false, type: 'string' })
  @ApiQuery({ name: 'availability', required: false, type: 'string' })
  @ApiQuery({ name: 'page', required: false, type: 'number' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiQuery({ name: 'sortBy', required: false, type: 'string' })
  @ApiQuery({ name: 'sortOrder', required: false, type: 'string' })
  @HttpCode(HttpStatus.OK)
  async getAllLeads(@Req() req: Request) {
    const filters = pick(req.query, [
      'searchTerm',
      'categoryId',
      'city',
      'state',
      'status',
      'availability',
      'source',
      'propertyType',
    ]);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.leadService.getAllLeads(filters, options);

    return {
      message: 'Leads fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single lead by ID',
  })
  @HttpCode(HttpStatus.OK)
  async getLeadById(@Param('id') id: string) {
    const result = await this.leadService.getSingleLead(id);
    return {
      message: 'Lead fetched successfully',
      data: result,
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a lead with optional property image',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @UseInterceptors(FileInterceptor('propertyImage', fileUpload.uploadConfig))
  @HttpCode(HttpStatus.OK)
  async updateLead(
    @Param('id') id: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const result = await this.leadService.updateLead(id, updateLeadDto, file);
    return {
      message: 'Lead updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a lead by ID',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @HttpCode(HttpStatus.OK)
  async deleteLead(@Param('id') id: string) {
    const result = await this.leadService.deleteLead(id);
    return {
      message: 'Lead deleted successfully',
      data: result,
    };
  }
}

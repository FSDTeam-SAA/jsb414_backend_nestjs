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
} from '@nestjs/swagger';
import type { Request } from 'express';
import { fileUpload } from 'src/app/helper/fileUploder';
import pick from 'src/app/helper/pick';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Create categories',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @UseInterceptors(FileInterceptor('logo', fileUpload.uploadConfig))
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const result = await this.categoriesService.createCategorie(
      createCategoryDto,
      file,
    );

    return {
      message: 'Category created successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all categories',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: 'string',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: 'string',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: 'number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: 'string',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    type: 'string',
  })
  @HttpCode(HttpStatus.OK)
  async getAllCategories(@Req() req: Request) {
    const filters = pick(req.query, ['searchTerm', 'name']);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.categoriesService.getAllCategories(
      filters,
      options,
    );
    return {
      message: 'Categories fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get category by id',
  })
  @HttpCode(HttpStatus.OK)
  async getCategoryById(@Param('id') id: string) {
    const result = await this.categoriesService.getSingleCategorie(id);
    return {
      message: 'Category fetched successfully',
      data: result,
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update category',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @UseInterceptors(FileInterceptor('logo', fileUpload.uploadConfig))
  @HttpCode(HttpStatus.OK)
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const result = await this.categoriesService.updateCategorie(
      id,
      updateCategoryDto,
      file,
    );
    return {
      message: 'Category updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete category',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'superadmin'))
  @HttpCode(HttpStatus.OK)
  async deleteCategory(@Param('id') id: string) {
    const result = await this.categoriesService.deleteCategorie(id);
    return {
      message: 'Category deleted successfully',
      data: result,
    };
  }
}

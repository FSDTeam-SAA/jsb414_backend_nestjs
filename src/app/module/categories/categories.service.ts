import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import buildWhereConditions from 'src/app/helper/buildWhereConditions';
import { fileUpload } from 'src/app/helper/fileUploder';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCategorie(
    createCategorieDto: CreateCategoryDto,
    file?: Express.Multer.File,
  ) {
    const { name, description } = createCategorieDto;
    const category = await this.prisma.catagorie.findFirst({
      where: {
        name: name,
      },
    });

    if (category) {
      throw new HttpException(
        'Category already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (file) {
      const { url } = await fileUpload.uploadToCloudinary(file);
      createCategorieDto.logo = url;
    }

    // const result = await this.prisma.catagorie.create({
    //   data: {
    //     name: name,
    //     description: description,
    //     logo: createCategorieDto.logo,
    //   },
    // });
    const result = await this.prisma.catagorie.create({
      data: {
        name: name,
        description: description,
        logo: createCategorieDto.logo,
        isActive:
          createCategorieDto.isActive !== undefined
            ? createCategorieDto.isActive
            : true,
        agePricingEnabled:
          createCategorieDto.agePricingEnabled !== undefined
            ? createCategorieDto.agePricingEnabled
            : false,
        sharedBasePrice: createCategorieDto.sharedBasePrice ?? null,
        exclusiveBasePrice: createCategorieDto.exclusiveBasePrice ?? null,
      },
    });

    if (!result) {
      throw new HttpException(
        'Internal Server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return result;
  }

  async getAllCategories(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);
    const whereConditions = buildWhereConditions(params, [
      'name',
      'description',
    ]);
    const [result, total] = await Promise.all([
      this.prisma.catagorie.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.catagorie.count({
        where: whereConditions,
      }),
    ]);
    return {
      data: result,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async getSingleCategorie(id: string) {
    const result = await this.prisma.catagorie.findUnique({
      where: {
        id: id,
      },
    });

    if (!result) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  async updateCategorie(
    id: string,
    updateCategorieDto: UpdateCategoryDto,
    file?: Express.Multer.File,
  ) {
    const existingCategory = await this.prisma.catagorie.findUnique({
      where: {
        id: id,
      },
    });

    if (!existingCategory) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }

    if (file) {
      const { url } = await fileUpload.uploadToCloudinary(file);
      updateCategorieDto.logo = url;
    }
    const result = await this.prisma.catagorie.update({
      where: {
        id: id,
      },
      data: updateCategorieDto,
    });
    return result;
  }

  async deleteCategorie(id: string) {
    const existingCategory = await this.prisma.catagorie.findUnique({
      where: {
        id: id,
      },
    });

    if (!existingCategory) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }

    const result = await this.prisma.catagorie.delete({
      where: {
        id: id,
      },
    });
    return result;
  }
}

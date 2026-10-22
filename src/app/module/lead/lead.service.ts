import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import buildWhereConditions from 'src/app/helper/buildWhereConditions';
import { fileUpload } from 'src/app/helper/fileUploder';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadService {
  constructor(private readonly prisma: PrismaService) {}

  async createLead(
    createLeadDto: CreateLeadDto,
    adminId: string,
    file?: Express.Multer.File,
  ) {
    // 1. Verify category exists
    const category = await this.prisma.catagorie.findUnique({
      where: { id: createLeadDto.categoryId },
    });
    if (!category) {
      throw new NotFoundException(
        `Category with ID '${createLeadDto.categoryId}' not found`,
      );
    }

    // 2. Upload property image to Cloudinary if provided
    let imageUrl = createLeadDto.propertyImage;
    if (file) {
      const uploadRes = await fileUpload.uploadToCloudinary(file);
      imageUrl = uploadRes.url;
    }

    // 3. Prepare data for Prisma
    const {
      categoryId,
      saleDate,
      stage,
      mortgageInformation,
      source,
      availability,
      sharedLimit,
      customPrice,
      status,
      propertyType,
      propertyAddress,
      city,
      state,
      zipcode,
      estValue,
      estEquity,
      firstName,
      lastName,
      phoneNumbers,
      emailAddresses,
    } = createLeadDto;

    const lead = await this.prisma.lead.create({
      data: {
        categoryId,
        adminId,
        saleDate: saleDate ? new Date(saleDate) : undefined,
        stage,
        mortgageInformation,
        source: source || 'Internal',
        availability: availability || 'SHARED',
        sharedLimit: sharedLimit ? Number(sharedLimit) : undefined,
        sharedBasePriceCents: customPrice ? Number(customPrice) : undefined,
        status: status || 'ACTIVE',
        propertyImage: imageUrl,
        propertyType,
        propertyAddress,
        city,
        state,
        zipcode,
        estValue: estValue ? Number(estValue) : undefined,
        estEquity: estEquity ? Number(estEquity) : undefined,
        firstName,
        lastName,
        phoneNumbers: phoneNumbers || [],
        emailAddresses: emailAddresses || [],
      },
      include: {
        category: true,
        admin: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return lead;
  }

  async getAllLeads(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);
    const searchableFields = [
      'firstName',
      'lastName',
      'propertyAddress',
      'city',
      'state',
      'zipcode',
      'stage',
      'source',
      'propertyType',
    ];

    const whereConditions = buildWhereConditions(params, searchableFields);

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          category: true,
          admin: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.lead.count({
        where: whereConditions,
      }),
    ]);

    return {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data,
    };
  }

  async getSingleLead(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        category: true,
        admin: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${id}' not found`);
    }

    return lead;
  }

  async updateLead(
    id: string,
    updateLeadDto: UpdateLeadDto,
    file?: Express.Multer.File,
  ) {
    const existing = await this.prisma.lead.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Lead with ID '${id}' not found`);
    }

    if (updateLeadDto.categoryId) {
      const category = await this.prisma.catagorie.findUnique({
        where: { id: updateLeadDto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(
          `Category with ID '${updateLeadDto.categoryId}' not found`,
        );
      }
    }

    let imageUrl = existing.propertyImage;
    if (file) {
      const uploadRes = await fileUpload.uploadToCloudinary(file);
      imageUrl = uploadRes.url;
    } else if (updateLeadDto.propertyImage !== undefined) {
      imageUrl = updateLeadDto.propertyImage;
    }

    const {
      categoryId,
      saleDate,
      stage,
      mortgageInformation,
      source,
      availability,
      sharedLimit,
      customPrice,
      status,
      propertyType,
      propertyAddress,
      city,
      state,
      zipcode,
      estValue,
      estEquity,
      firstName,
      lastName,
      phoneNumbers,
      emailAddresses,
    } = updateLeadDto;

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        ...(categoryId && { categoryId }),
        ...(saleDate && { saleDate: new Date(saleDate) }),
        ...(stage !== undefined && { stage }),
        ...(mortgageInformation !== undefined && { mortgageInformation }),
        ...(source !== undefined && { source }),
        ...(availability && { availability }),
        ...(sharedLimit !== undefined && {
          sharedLimit: sharedLimit ? Number(sharedLimit) : null,
        }),
        ...(customPrice !== undefined && {
          sharedBasePriceCents: customPrice ? Number(customPrice) : null,
        }),
        ...(status !== undefined && { status }),
        ...(imageUrl !== undefined && { propertyImage: imageUrl }),
        ...(propertyType !== undefined && { propertyType }),
        ...(propertyAddress !== undefined && { propertyAddress }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(zipcode !== undefined && { zipcode }),
        ...(estValue !== undefined && {
          estValue: estValue ? Number(estValue) : null,
        }),
        ...(estEquity !== undefined && {
          estEquity: estEquity ? Number(estEquity) : null,
        }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phoneNumbers !== undefined && { phoneNumbers }),
        ...(emailAddresses !== undefined && { emailAddresses }),
      },
      include: {
        category: true,
        admin: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return updated;
  }

  async deleteLead(id: string) {
    const existing = await this.prisma.lead.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Lead with ID '${id}' not found`);
    }

    const deleted = await this.prisma.lead.delete({
      where: { id },
    });

    return deleted;
  }
}

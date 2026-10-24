import {
  BadRequestException,
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
    const category = await this.prisma.catagorie.findUnique({
      where: { id: createLeadDto.categoryId },
    });
    if (!category) {
      throw new NotFoundException(
        `Category with ID '${createLeadDto.categoryId}' not found`,
      );
    }

    let imageUrl = createLeadDto.propertyImage;
    if (file) {
      const uploadRes = await fileUpload.uploadToCloudinary(file);
      imageUrl = uploadRes.url;
    }

    const {
      categoryId,
      saleDate,
      stage,
      mortgageInformation,
      source = 'Internal',
      availability = 'SHARED',
      sharedLimit,
      priceCents,
      customPrice,
      status = 'ACTIVE',
      propertyType,
      propertyAddress,
      city,
      state,
      zipcode,
      estValue,
      estEquity,
      firstName,
      lastName,
      phoneNumbers = [],
      emailAddresses = [],
    } = createLeadDto;

    const custom = priceCents ?? customPrice;

    // Availability অনুযায়ী অটোমেটিক প্রাইস রিজলভ
    let sharedBasePriceCents: number | null = null;
    let exclusiveBasePriceCents: number | null = null;

    if (availability === 'SHARED') {
      sharedBasePriceCents =
        custom !== undefined
          ? Number(custom)
          : (category.sharedBasePriceCents ?? 2000);
    } else if (availability === 'EXCLUSIVE') {
      exclusiveBasePriceCents =
        custom !== undefined
          ? Number(custom)
          : (category.exclusiveBasePriceCents ?? 5000);
    } else if (availability === 'BOTH') {
      sharedBasePriceCents =
        custom !== undefined
          ? Number(custom)
          : (category.sharedBasePriceCents ?? 2000);
      exclusiveBasePriceCents = category.exclusiveBasePriceCents ?? 5000;
    }

    const lead = await this.prisma.lead.create({
      data: {
        categoryId,
        adminId,
        source: source || 'Internal',
        saleDate: saleDate ? new Date(saleDate) : undefined,
        stage,
        mortgageInformation,
        availability,
        sharedLimit: sharedLimit
          ? Number(sharedLimit)
          : availability !== 'EXCLUSIVE'
            ? 5
            : null,
        sharedBasePriceCents,
        exclusiveBasePriceCents,
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
      priceCents,
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
        ...((priceCents ?? customPrice) !== undefined && {
          sharedBasePriceCents:
            (availability ?? existing.availability) !== 'EXCLUSIVE'
              ? (priceCents ?? customPrice)
                ? Number(priceCents ?? customPrice)
                : null
              : null,
          exclusiveBasePriceCents:
            (availability ?? existing.availability) !== 'SHARED'
              ? (priceCents ?? customPrice)
                ? Number(priceCents ?? customPrice)
                : null
              : null,
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

  async bulkUploadLeads(
    file: Express.Multer.File,
    adminId: string,
    defaultCategoryId?: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('A CSV or Excel file is required');
    }

    const rows = this.parseSpreadsheetFile(file);
    if (!rows || rows.length === 0) {
      throw new BadRequestException('The uploaded file contains no data rows');
    }

    // Cache categories so we can resolve by ID or Name
    const allCategories = await this.prisma.catagorie.findMany({
      select: { id: true, name: true },
    });
    const categoryMapByName = new Map<string, string>();
    const categoryIdSet = new Set<string>();
    for (const cat of allCategories) {
      categoryIdSet.add(cat.id);
      categoryMapByName.set(cat.name.trim().toLowerCase(), cat.id);
    }

    const leadsToCreate: any[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // spreadsheet 1-indexed header is row 1

      // 1. Resolve category
      let categoryId =
        this.getFieldValue(row, ['categoryid', 'category_id', 'category']) ||
        defaultCategoryId;

      if (categoryId && !categoryIdSet.has(categoryId)) {
        // Try matching by category name
        const matched = categoryMapByName.get(categoryId.trim().toLowerCase());
        if (matched) {
          categoryId = matched;
        }
      }

      if (!categoryId || !categoryIdSet.has(categoryId)) {
        errors.push({
          row: rowNum,
          error: `Invalid or missing category '${categoryId || 'N/A'}'. Provide a valid category ID/name or pass defaultCategoryId.`,
        });
        continue;
      }

      // 2. Parse sale date
      const rawSaleDate = this.getFieldValue(row, [
        'saledate',
        'sale_date',
        'auctiondate',
        'auction_date',
        'date',
      ]);
      let saleDate: Date | undefined;
      if (rawSaleDate) {
        const d = new Date(rawSaleDate);
        if (!isNaN(d.getTime())) {
          saleDate = d;
        }
      }

      // 3. String & Numeric fields
      const stage = this.getFieldValue(row, [
        'stage',
        'foreclosurestage',
        'foreclosure_stage',
      ]);
      const mortgageInformation = this.getFieldValue(row, [
        'mortgageinformation',
        'mortgage_information',
        'mortgage',
      ]);
      const source =
        this.getFieldValue(row, ['source']) ||
        file.originalname ||
        'Spreadsheet Import';
      const rawAvailability = (
        this.getFieldValue(row, ['availability']) || 'SHARED'
      ).toUpperCase();
      const availability = ['SHARED', 'EXCLUSIVE', 'BOTH'].includes(
        rawAvailability,
      )
        ? (rawAvailability as any)
        : 'SHARED';

      const sharedLimit = this.parseNumber(
        this.getFieldValue(row, ['sharedlimit', 'shared_limit']),
      );
      const customPrice = this.parseNumber(
        this.getFieldValue(row, [
          'customprice',
          'custom_price',
          'price',
          'baseprice',
        ]),
      );
      const status = this.getFieldValue(row, ['status']) || 'ACTIVE';
      const propertyType = this.getFieldValue(row, [
        'propertytype',
        'property_type',
        'type',
      ]);
      const propertyAddress = this.getFieldValue(row, [
        'propertyaddress',
        'property_address',
        'address',
        'street',
      ]);
      const city = this.getFieldValue(row, ['city']);
      const state = this.getFieldValue(row, ['state']);
      const zipcode = this.getFieldValue(row, ['zipcode', 'zip', 'postalcode']);
      const estValue = this.parseNumber(
        this.getFieldValue(row, [
          'estvalue',
          'est_value',
          'value',
          'estimatedvalue',
        ]),
      );
      const estEquity = this.parseNumber(
        this.getFieldValue(row, [
          'estequity',
          'est_equity',
          'equity',
          'estimatedequity',
        ]),
      );
      const firstName = this.getFieldValue(row, ['firstname', 'first_name']);
      const lastName = this.getFieldValue(row, ['lastname', 'last_name']);
      const propertyImage = this.getFieldValue(row, [
        'propertyimage',
        'property_image',
        'image',
        'imageurl',
      ]);

      // 4. Arrays: phone numbers and emails
      const rawPhones = this.getFieldValue(row, [
        'phonenumbers',
        'phone_numbers',
        'phones',
        'phone',
        'phonenumber',
      ]);
      const phoneNumbers = this.parseStringArray(rawPhones);

      const rawEmails = this.getFieldValue(row, [
        'emailaddresses',
        'email_addresses',
        'emails',
        'email',
        'emailaddress',
      ]);
      const emailAddresses = this.parseStringArray(rawEmails);

      leadsToCreate.push({
        categoryId,
        adminId,
        saleDate,
        stage,
        mortgageInformation,
        source,
        availability,
        sharedLimit: sharedLimit ? Math.round(sharedLimit) : undefined,
        sharedBasePriceCents: customPrice ? Math.round(customPrice) : undefined,
        status,
        propertyImage,
        propertyType,
        propertyAddress,
        city,
        state,
        zipcode,
        estValue: estValue ? Math.round(estValue) : undefined,
        estEquity: estEquity ? Math.round(estEquity) : undefined,
        firstName,
        lastName,
        phoneNumbers,
        emailAddresses,
      });
    }

    if (leadsToCreate.length === 0) {
      throw new BadRequestException({
        message: 'No valid leads could be imported from the file',
        errors,
      });
    }

    // Insert leads
    const createdCount = await this.prisma.lead.createMany({
      data: leadsToCreate,
    });

    return {
      totalRows: rows.length,
      importedCount: createdCount.count,
      failedCount: errors.length,
      errors: errors.slice(0, 50), // Show up to first 50 errors
    };
  }

  private parseSpreadsheetFile(
    file: Express.Multer.File,
  ): Record<string, any>[] {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const isCsv =
      file.mimetype === 'text/csv' ||
      file.originalname.toLowerCase().endsWith('.csv');

    // XLSX library supports CSV, XLSX, XLS directly from buffer
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const xlsx = require('xlsx');
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(worksheet, {
      defval: '',
    }) as Record<string, any>[];

    // Normalize keys to lowercase stripped of spaces/underscores for flexible matching
    return rawRows.map((row) => {
      const normalizedRow: Record<string, any> = {};
      for (const [key, val] of Object.entries(row)) {
        const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        normalizedRow[cleanKey] = val;
      }
      return normalizedRow;
    });
  }

  private getFieldValue(
    row: Record<string, any>,
    possibleKeys: string[],
  ): string | undefined {
    for (const key of possibleKeys) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        row[cleanKey] !== undefined &&
        row[cleanKey] !== null &&
        String(row[cleanKey]).trim() !== ''
      ) {
        return String(row[cleanKey]).trim();
      }
    }
    return undefined;
  }

  private parseNumber(val?: string | number): number | undefined {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'number') return isNaN(val) ? undefined : val;
    // eslint-disable-next-line no-useless-escape
    const cleanStr = String(val).replace(/[\$,]/g, '').trim();
    const num = Number(cleanStr);
    return isNaN(num) ? undefined : num;
  }

  private parseStringArray(val?: any): string[] {
    if (!val) return [];
    if (Array.isArray(val))
      return val.map((s) => String(s).trim()).filter(Boolean);
    const str = String(val).trim();
    if (!str) return [];
    if (str.startsWith('[') && str.endsWith(']')) {
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed))
          return parsed.map((s) => String(s).trim()).filter(Boolean);
      } catch {
        // Fall back to splitting
      }
    }
    return str
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

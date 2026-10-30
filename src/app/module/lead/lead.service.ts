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

  // 1. নতুন লিড তৈরি (সহজ, পরিষ্কার ও স্বয়ংক্রিয় প্রাইসিং)
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

    const availability = createLeadDto.availability || 'SHARED';

    // ঠিকানা ও ফোন/ইমেইল থাকলে অটোমেটিক SELLABLE
    const hasAddress = Boolean(
      createLeadDto.propertyAddress?.trim() &&
      createLeadDto.city?.trim() &&
      createLeadDto.state?.trim(),
    );
    const hasContact = Boolean(
      (createLeadDto.phoneNumbers && createLeadDto.phoneNumbers.length > 0) ||
      (createLeadDto.emailAddresses && createLeadDto.emailAddresses.length > 0),
    );
    const classification =
      hasAddress && hasContact ? 'SELLABLE' : 'NEEDS_REVIEW';

    const lead = await this.prisma.lead.create({
      data: {
        categoryId: createLeadDto.categoryId,
        adminId,
        classification,
        source: createLeadDto.source || 'Internal',
        saleDate: createLeadDto.saleDate
          ? new Date(createLeadDto.saleDate)
          : undefined,
        stage: createLeadDto.stage,
        mortgageInformation: createLeadDto.mortgageInformation,
        mortgageBalance: createLeadDto.mortgageBalance
          ? Number(createLeadDto.mortgageBalance)
          : undefined,
        availability,
        sharedLimit: createLeadDto.sharedLimit
          ? Number(createLeadDto.sharedLimit)
          : availability !== 'EXCLUSIVE'
            ? 5
            : null,
        status: createLeadDto.status || 'ACTIVE',
        propertyImage: imageUrl,
        propertyType: createLeadDto.propertyType,
        propertyAddress: createLeadDto.propertyAddress,
        unitNumber: createLeadDto.unitNumber,
        city: createLeadDto.city,
        state: createLeadDto.state,
        zipcode: createLeadDto.zipcode,
        county: createLeadDto.county,
        estValue: createLeadDto.estValue
          ? Number(createLeadDto.estValue)
          : undefined,
        estEquity: createLeadDto.estEquity
          ? Number(createLeadDto.estEquity)
          : undefined,
        firstName: createLeadDto.firstName,
        lastName: createLeadDto.lastName,
        phoneNumbers: createLeadDto.phoneNumbers || [],
        emailAddresses: createLeadDto.emailAddresses || [],
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

    return this.withCategoryPrices(lead);
  }

  // 2. সকল লিড দেখা (অ্যাডমিনের জন্য)
  async getAllLeads(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);
    const searchableFields = [
      'firstName',
      'lastName',
      'propertyAddress',
      'city',
      'state',
      'county',
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
      data: data.map((lead) => this.withCategoryPrices(lead)),
    };
  }

  // 3. সিঙ্গেল লিড বিস্তারিত
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

    return this.withCategoryPrices(lead);
  }

  // 4. লিড আপডেট
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

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        ...(updateLeadDto.categoryId && {
          categoryId: updateLeadDto.categoryId,
        }),
        ...(updateLeadDto.saleDate && {
          saleDate: new Date(updateLeadDto.saleDate),
        }),
        ...(updateLeadDto.stage !== undefined && {
          stage: updateLeadDto.stage,
        }),
        ...(updateLeadDto.mortgageInformation !== undefined && {
          mortgageInformation: updateLeadDto.mortgageInformation,
        }),
        ...(updateLeadDto.mortgageBalance !== undefined && {
          mortgageBalance: updateLeadDto.mortgageBalance
            ? Number(updateLeadDto.mortgageBalance)
            : null,
        }),
        ...(updateLeadDto.source !== undefined && {
          source: updateLeadDto.source,
        }),
        ...(updateLeadDto.availability && {
          availability: updateLeadDto.availability,
        }),
        ...(updateLeadDto.sharedLimit !== undefined && {
          sharedLimit: updateLeadDto.sharedLimit
            ? Number(updateLeadDto.sharedLimit)
            : null,
        }),
        ...(updateLeadDto.status !== undefined && {
          status: updateLeadDto.status,
        }),
        ...(imageUrl !== undefined && { propertyImage: imageUrl }),
        ...(updateLeadDto.propertyType !== undefined && {
          propertyType: updateLeadDto.propertyType,
        }),
        ...(updateLeadDto.propertyAddress !== undefined && {
          propertyAddress: updateLeadDto.propertyAddress,
        }),
        ...(updateLeadDto.unitNumber !== undefined && {
          unitNumber: updateLeadDto.unitNumber,
        }),
        ...(updateLeadDto.city !== undefined && { city: updateLeadDto.city }),
        ...(updateLeadDto.state !== undefined && {
          state: updateLeadDto.state,
        }),
        ...(updateLeadDto.zipcode !== undefined && {
          zipcode: updateLeadDto.zipcode,
        }),
        ...(updateLeadDto.county !== undefined && {
          county: updateLeadDto.county,
        }),
        ...(updateLeadDto.estValue !== undefined && {
          estValue: updateLeadDto.estValue
            ? Number(updateLeadDto.estValue)
            : null,
        }),
        ...(updateLeadDto.estEquity !== undefined && {
          estEquity: updateLeadDto.estEquity
            ? Number(updateLeadDto.estEquity)
            : null,
        }),
        ...(updateLeadDto.firstName !== undefined && {
          firstName: updateLeadDto.firstName,
        }),
        ...(updateLeadDto.lastName !== undefined && {
          lastName: updateLeadDto.lastName,
        }),
        ...(updateLeadDto.phoneNumbers !== undefined && {
          phoneNumbers: updateLeadDto.phoneNumbers,
        }),
        ...(updateLeadDto.emailAddresses !== undefined && {
          emailAddresses: updateLeadDto.emailAddresses,
        }),
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

    return this.withCategoryPrices(updated);
  }

  // 5. লিড ডিলিট (কেনা থাকলে ARCHIVED, না থাকলে ডিলিট)
  async deleteLead(id: string) {
    const existing = await this.prisma.lead.findUnique({
      where: { id },
      include: { userLead: true },
    });

    if (!existing) {
      throw new NotFoundException('Lead not found');
    }

    if (existing.userLead && existing.userLead.length > 0) {
      return await this.prisma.lead.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
    }

    return await this.prisma.lead.delete({
      where: { id },
    });
  }

  // 6. বাল্ক আপলোড (সহজ, পরিষ্কার ও আপসার্ট লজিক)
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

    // ১. বিদ্যমান ক্যাটাগরিগুলো লোড করা
    const allCategories = await this.prisma.catagorie.findMany({
      select: { id: true, name: true },
    });
    const categoryMapByName = new Map<string, string>();
    const categoryIdSet = new Set<string>();
    for (const cat of allCategories) {
      categoryIdSet.add(cat.id);
      categoryMapByName.set(cat.name.trim().toLowerCase(), cat.id);
    }

    // ২. ডুপ্লিকেট চেকের জন্য ফাইলের ঠিকানাগুলো সংগ্রহ করা
    const addressList: string[] = [];
    for (const row of rows) {
      const addr = this.getFieldValue(row, [
        'propertyaddress',
        'property_address',
        'address',
        'street',
      ]);
      if (addr) addressList.push(addr);
    }

    // ডেটাবেজে ইতিমধ্যে থাকা একই ঠিকানার লিড খুঁজে বের করা
    const existingLeads = await this.prisma.lead.findMany({
      where: {
        propertyAddress: { in: addressList },
      },
      select: {
        id: true,
        propertyAddress: true,
        zipcode: true,
      },
    });

    const normalizeKey = (address?: string | null, zip?: string | null) =>
      `${(address || '').trim().toLowerCase()}_${(zip || '').trim().toLowerCase()}`;

    const existingLeadMap = new Map<string, string>();
    for (const lead of existingLeads) {
      if (lead.propertyAddress) {
        existingLeadMap.set(
          normalizeKey(lead.propertyAddress, lead.zipcode),
          lead.id,
        );
      }
    }

    let createdCount = 0;
    let updatedCount = 0;
    let sellableCount = 0;
    let needsReviewCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    // ৩. প্রতিটি রো প্রসেস করা
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // ক. ক্যাটাগরি ম্যাচিং (Case-insensitive)
      let categoryId =
        this.getFieldValue(row, ['categoryid', 'category_id', 'category']) ||
        defaultCategoryId;

      if (categoryId && !categoryIdSet.has(categoryId)) {
        const matched = categoryMapByName.get(categoryId.trim().toLowerCase());
        if (matched) {
          categoryId = matched;
        }
      }

      // যদি ফাইলে নতুন কোনো ক্যাটাগরির নাম থাকে, অটো-ক্রিয়েট করবে যাতে এরর না খায়
      if (!categoryId || !categoryIdSet.has(categoryId)) {
        const rawCatName = this.getFieldValue(row, [
          'categoryid',
          'category_id',
          'category',
        ]);
        if (rawCatName && rawCatName.trim()) {
          const newCat = await this.prisma.catagorie.create({
            data: {
              name: rawCatName.trim(),
              description: `${rawCatName.trim()} Leads`,
              sharedBasePrice: 25,
              exclusiveBasePrice: 75,
              isActive: true,
            },
          });
          categoryId = newCat.id;
          categoryIdSet.add(newCat.id);
          categoryMapByName.set(rawCatName.trim().toLowerCase(), newCat.id);
        } else if (defaultCategoryId && categoryIdSet.has(defaultCategoryId)) {
          categoryId = defaultCategoryId;
        } else {
          errors.push({
            row: rowNum,
            error: `Row ${rowNum}: Category '${categoryId || 'N/A'}' not found. Please provide a category or defaultCategoryId.`,
          });
          continue;
        }
      }

      // খ. ফিল্ডগুলো রিড করা
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
      const unitNumber = this.getFieldValue(row, [
        'unitnumber',
        'unit_number',
        'unit',
        'apt',
      ]);
      const city = this.getFieldValue(row, ['city']);
      const state = this.getFieldValue(row, ['state']);
      const zipcode = this.getFieldValue(row, ['zipcode', 'zip', 'postalcode']);
      const county = this.getFieldValue(row, ['county']);

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
      const mortgageBalance = this.parseNumber(
        this.getFieldValue(row, [
          'mortgagebalance',
          'mortgage_balance',
          'loanbalance',
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

      // গ. ক্লাসিফিকেশন যাচাই (ঠিকানা + ফোন/ইমেইল থাকলে SELLABLE, না থাকলে NEEDS_REVIEW)
      const hasAddress = Boolean(propertyAddress && city && state);
      const hasContact = Boolean(
        (phoneNumbers && phoneNumbers.length > 0) ||
        (emailAddresses && emailAddresses.length > 0),
      );
      const classification =
        hasAddress && hasContact ? 'SELLABLE' : 'NEEDS_REVIEW';

      if (classification === 'SELLABLE') {
        sellableCount++;
      } else {
        needsReviewCount++;
      }

      // ঘ. লিডের অবজেক্ট তৈরি
      const leadPayload = {
        categoryId,
        saleDate,
        stage,
        mortgageInformation,
        source,
        availability,
        sharedLimit: sharedLimit ? Math.round(sharedLimit) : undefined,
        status,
        propertyImage,
        propertyType,
        propertyAddress,
        unitNumber,
        city,
        state,
        zipcode,
        county,
        estValue: estValue ? Math.round(estValue) : undefined,
        estEquity: estEquity ? Math.round(estEquity) : undefined,
        mortgageBalance: mortgageBalance
          ? Math.round(mortgageBalance)
          : undefined,
        firstName,
        lastName,
        phoneNumbers,
        emailAddresses,
        classification,
        lastImportedAt: new Date(),
      };

      // ঙ. ডুপ্লিকেট চেক (ঠিকানা ও জিপকোড মিললে আপডেট, না মিললে নতুন তৈরি)
      const leadKey = normalizeKey(propertyAddress, zipcode);
      const existingId = propertyAddress ? existingLeadMap.get(leadKey) : null;

      if (existingId) {
        await this.prisma.lead.update({
          where: { id: existingId },
          data: leadPayload,
        });
        updatedCount++;
      } else {
        const created = await this.prisma.lead.create({
          data: {
            ...leadPayload,
            adminId,
          },
        });
        if (propertyAddress) {
          existingLeadMap.set(leadKey, created.id);
        }
        createdCount++;
      }
    }

    if (createdCount === 0 && updatedCount === 0) {
      throw new BadRequestException({
        message: 'No leads could be imported from the file',
        errors,
      });
    }

    return {
      totalRows: rows.length,
      createdCount,
      updatedCount,
      sellableCount,
      needsReviewCount,
      failedCount: errors.length,
      errors: errors.slice(0, 50),
    };
  }

  // Lead price always follows its category; no copied/manual price to go stale.
  private withCategoryPrices(lead: any) {
    return {
      ...lead,
      sharedPrice:
        lead.availability === 'EXCLUSIVE'
          ? null
          : lead.category.sharedBasePrice,
      exclusivePrice:
        lead.availability === 'SHARED'
          ? null
          : lead.category.exclusiveBasePrice,
      currency: 'USD',
    };
  }

  private parseSpreadsheetFile(
    file: Express.Multer.File,
  ): Record<string, any>[] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const xlsx = require('xlsx');
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(worksheet, {
      defval: '',
    }) as Record<string, any>[];

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

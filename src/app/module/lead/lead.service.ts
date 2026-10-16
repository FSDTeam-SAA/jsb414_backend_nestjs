import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class LeadService {
  constructor(private readonly prisma: PrismaService) {}

  // async createLead(createLeadDto: CreateLeadDto, file?: Express.Multer.File) {
  //   if (file) {
  //     const { url } = await fileUpload.uploadToCloudinary(file);
  //     createLeadDto.propertyImage = url;
  //   }
  //   const result = await this.prisma.lead.create({
  //     data: createLeadDto,
  //   });
  //   return result;
  // }
}

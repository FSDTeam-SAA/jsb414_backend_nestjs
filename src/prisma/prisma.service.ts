// src/prisma/prisma.service.ts
import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 15000,
    });
    super({ adapter });
  }

  // NestJS অ্যাপ চালু হলে ডাটাবেজ কানেক্ট হবে
  async onModuleInit() {
    await this.$connect();
  }

  // অ্যাপ বন্ধ হলে কানেকশন সুন্দরভাবে ক্লোজ হবে
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}

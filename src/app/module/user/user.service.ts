import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import buildWhereConditions from '../../helper/buildWhereConditions';
import { fileUpload } from '../../helper/fileUploder';
import paginationHelper, { IOptions } from '../../helper/pagenation';
import { IFilterParams } from '../../helper/pick';
import { publicUserSelect } from '../../helper/public-user-select';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUser(params: IFilterParams, options: IOptions) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper(options);
    const whenCondition = buildWhereConditions(params, [
      'firstName',
      'lastName',
      'email',
      'phoneNumber',
    ]);

    const [result, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whenCondition,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        select: publicUserSelect,
      }),
      this.prisma.user.count({
        where: whenCondition,
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

  async getSingleUser(userId: string) {
    const data = await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
      select: publicUserSelect,
    });
    return data;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (existingEmail) {
        throw new HttpException('Email already in use', HttpStatus.BAD_REQUEST);
      }
    }

    const updateData: Record<string, any> = {};
    if (updateUserDto.firstName) updateData.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName) updateData.lastName = updateUserDto.lastName;
    if (updateUserDto.email) updateData.email = updateUserDto.email;
    if (updateUserDto.phoneNumber !== undefined)
      updateData.phoneNumber = updateUserDto.phoneNumber;
    if (updateUserDto.photo) updateData.photo = updateUserDto.photo;

    const data = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: publicUserSelect,
    });
    return data;
  }

  async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto,
    file?: Express.Multer.File,
  ) {
    let photoUrl = updateUserDto.photo;

    if (file) {
      const uploadRes = await fileUpload.uploadToCloudinary(file);
      photoUrl = uploadRes.url;
    }

    return this.update(userId, {
      ...updateUserDto,
      ...(photoUrl ? { photo: photoUrl } : {}),
    });
  }
}

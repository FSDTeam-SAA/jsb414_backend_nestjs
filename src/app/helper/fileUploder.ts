import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import streamifier from 'streamifier';
import { v2 as cloudinary } from 'cloudinary';
import config from '../config';
import { HttpException } from '@nestjs/common';

cloudinary.config({
  cloud_name: config.cloudinary.name,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

const uploadConfig: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
    fields: 50,
    fieldSize: 64 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(
        new HttpException('Only JPEG, PNG and WebP images are allowed', 400),
        false,
      );
    }
    callback(null, true);
  },
};

const uploadToCloudinary = async (
  file: Express.Multer.File,
): Promise<{ url: string; public_id: string }> => {
  if (!file) throw new HttpException('No file provided', 400);
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'foreclosure_gold/profiles',
        resource_type: 'image',
        format: 'webp',
        transformation: {
          width: 500,
          height: 500,
          crop: 'limit',
        },
      },
      (error, result) => {
        if (error) return reject(error);

        if (!result) {
          return reject(new Error('Upload failed - no result returned'));
        }
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );
    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};

const deleteFromCloudinary = async (public_id: string): Promise<void> => {
  if (!public_id) return;
  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (error) {
    console.error('Cloudinary delete failed:', error);
  }
};

export const fileUpload = {
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadConfig,
};

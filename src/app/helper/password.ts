import { BadRequestException } from '@nestjs/common';

// bcrypt handles at most 72 bytes; Unicode characters can use several bytes.
export function validatePasswordBytes(password: string) {
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new BadRequestException('Password must not exceed 72 UTF-8 bytes');
  }
}

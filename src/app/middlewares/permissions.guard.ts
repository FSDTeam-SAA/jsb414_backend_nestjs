import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // কোনো পারমিশন স্পেসিফাই না থাকলে চেক করার প্রয়োজন নেই
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    // সুপার অ্যাডমিনের সবসময় সব অ্যাকশনে ফুল এক্সেস থাকবে
    if (user.role === 'superadmin') {
      return true;
    }

    // সাধারণ অ্যাডমিনের ক্ষেত্রে পারমিশন চেক করা হবে
    if (user.role === 'admin') {
      const userPermissions = user.permissions || [];
      const hasPermission = requiredPermissions.some((perm) =>
        userPermissions.includes(perm),
      );

      if (hasPermission) {
        return true;
      }

      throw new ForbiddenException(
        `Access denied. You lack the required permission: [${requiredPermissions.join(', ')}]`,
      );
    }

    throw new ForbiddenException('Access denied');
  }
}

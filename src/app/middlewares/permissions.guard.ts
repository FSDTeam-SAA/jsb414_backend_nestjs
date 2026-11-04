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

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    // 1. Unauthenticated requests:
    if (!user) {
      // If a route explicitly requires permissions, block
      if (requiredPermissions && requiredPermissions.length > 0) {
        throw new ForbiddenException('User is not authenticated');
      }
      return true;
    }

    // 2. Super Admin always has full access to all endpoints
    if (user.role === 'superadmin') {
      return true;
    }

    // 3. Staff Admin:
    if (user.role === 'admin') {
      const userPermissions = (user.permissions || []).map((p: string) =>
        String(p).trim().toUpperCase(),
      );
      const isReadOnly =
        userPermissions.includes('READ_ONLY') ||
        userPermissions.includes('READONLY');
      const method = (request.method || 'GET').toUpperCase();

      // Read-Only Enforcement:
      // Read-Only admins CANNOT perform any create, update, delete or mutating action
      if (isReadOnly) {
        // Allow read-only queries (GET and HEAD)
        if (method === 'GET' || method === 'HEAD') {
          return true;
        }
        // Strict denial for all mutating requests
        throw new ForbiddenException(
          'Read-only admin accounts cannot perform create, edit, delete, or any mutating action',
        );
      }

      // If no specific module permissions required, allow admin access
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
      }

      // Module permission verification
      const hasPermission = requiredPermissions.some((perm) =>
        userPermissions.includes(perm.toUpperCase()),
      );

      if (hasPermission) {
        return true;
      }

      throw new ForbiddenException(
        `Access denied. You lack the required permission: [${requiredPermissions.join(', ')}]`,
      );
    }

    // 4. Regular users/customers:
    if (requiredPermissions && requiredPermissions.length > 0) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}

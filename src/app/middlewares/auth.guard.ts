import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  mixin,
  Type,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import config from '../config';
import { passwordVersion } from '../helper/token';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  purpose: 'access';
  passwordVersion: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function AuthGuard(...roles: string[]): Type<CanActivate> {
  @Injectable()
  class MiddlewaresGuard implements CanActivate {
    constructor(
      readonly jwtService: JwtService,
      readonly prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<Request>();
      const match = /^Bearer ([^\s]+)$/i.exec(
        request.headers.authorization || '',
      );
      if (!match) throw new UnauthorizedException('Bearer token is required');

      let decoded: JwtPayload;
      try {
        decoded = this.jwtService.verify<JwtPayload>(match[1], {
          secret: config.jwt.accessTokenSecret,
          algorithms: ['HS256'],
        });
      } catch {
        throw new UnauthorizedException('Invalid or expired access token');
      }
      if (decoded.purpose !== 'access' || typeof decoded.id !== 'string') {
        throw new UnauthorizedException('Invalid access token');
      }

      // Read the current role so a removed admin does not keep old permissions.
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.id },
      });
      if (!user || decoded.passwordVersion !== passwordVersion(user.password)) {
        throw new UnauthorizedException('Please login again');
      }
      if (roles.length && !roles.includes(user.role))
        throw new ForbiddenException('Forbidden');
      request.user = { ...decoded, email: user.email, role: user.role };
      return true;
    }
  }
  return mixin(MiddlewaresGuard);
}

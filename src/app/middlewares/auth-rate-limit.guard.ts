import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// Simple protection for the current single-instance deployment.
// Use a gateway/shared limiter before running multiple app instances.
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly requests = new Map<
    string,
    { count: number; expiresAt: number }
  >();
  private readonly windowMs = 15 * 60 * 1000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const now = Date.now();
    for (const [key, entry] of this.requests) {
      if (entry.expiresAt <= now) this.requests.delete(key);
    }
    // Never trust arbitrary X-Forwarded-For headers.
    const keys = [
      'ip:' + (request.ip || request.socket.remoteAddress || 'unknown'),
    ];
    const email = request.body?.email;
    if (typeof email === 'string' && email.length <= 254)
      keys.push('email:' + email.trim().toLowerCase());
    const entries = keys.map((key) => this.requests.get(key));
    if (
      entries.some((entry) => entry && entry.count >= 20) ||
      (keys.some((key) => !this.requests.has(key)) &&
        this.requests.size >= 10000)
    ) {
      response.setHeader('Retry-After', '900');
      throw new HttpException(
        'Too many authentication requests. Try again later.',
        429,
      );
    }
    keys.forEach((key, index) => {
      const entry = entries[index] || {
        count: 0,
        expiresAt: now + this.windowMs,
      };
      entry.count += 1;
      this.requests.set(key, entry);
    });
    return true;
  }
}

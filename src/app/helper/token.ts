import { createHash } from 'node:crypto';

export function tokenDurationSeconds(value: string): number {
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(value);
  if (!match) throw new Error('Invalid token duration; use 15m, 1h or 7d');
  const units = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * units[match[2] as keyof typeof units];
}

// A password change invalidates tokens issued with the previous password hash.
export function passwordVersion(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex');
}

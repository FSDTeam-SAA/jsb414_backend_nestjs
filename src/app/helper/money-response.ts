import { Prisma } from '../../../prisma/generated/prisma/client';

// PostgreSQL keeps exact Decimal dollars; API clients receive ordinary USD numbers.
export function moneyResponse(value: any): any {
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (
    value === null ||
    typeof value !== 'object' ||
    value instanceof Date ||
    Buffer.isBuffer(value)
  )
    return value;
  if (Array.isArray(value)) return value.map(moneyResponse);
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          ![
            'legacySharedPrice',
            'legacyExclusivePrice',
            'legacyPriceText',
          ].includes(key),
      )
      .map(([key, item]) => [key, moneyResponse(item)]),
  );
}

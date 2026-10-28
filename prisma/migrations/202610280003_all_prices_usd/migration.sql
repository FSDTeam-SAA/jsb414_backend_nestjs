-- All remaining selling prices become exact USD dollars.
-- Local data audit: category/rule numbers were entered as dollars despite Cents names.
-- Preserve those numbers; only the old membership/order contracts used actual cents.
-- Do not reuse this conversion policy on another database without auditing its units.
-- See docs/ALL-PRICES-USD.bn.md. This migration has NOT been run automatically.
BEGIN;
LOCK TABLE "catagories", "age_price_rules", "leads", "subscribes", "orders", "order_items", "user_leads" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "catagories" RENAME COLUMN "sharedBasePriceCents" TO "sharedBasePrice";
ALTER TABLE "catagories" ALTER COLUMN "sharedBasePrice" TYPE DECIMAL(14,2) USING ("sharedBasePrice"::numeric);
ALTER TABLE "catagories" RENAME COLUMN "exclusiveBasePriceCents" TO "exclusiveBasePrice";
ALTER TABLE "catagories" ALTER COLUMN "exclusiveBasePrice" TYPE DECIMAL(14,2) USING ("exclusiveBasePrice"::numeric);

ALTER TABLE "age_price_rules" RENAME COLUMN "priceCents" TO "price";
ALTER TABLE "age_price_rules" ALTER COLUMN "price" TYPE DECIMAL(14,2) USING ("price"::numeric);

-- Keep original numeric lead values verbatim for audit, never use them for pricing.
ALTER TABLE "leads" RENAME COLUMN "sharedBasePriceCents" TO "legacySharedPrice";
ALTER TABLE "leads" ALTER COLUMN "legacySharedPrice" TYPE DECIMAL(14,2) USING ("legacySharedPrice"::numeric);
ALTER TABLE "leads" RENAME COLUMN "exclusiveBasePriceCents" TO "legacyExclusivePrice";
ALTER TABLE "leads" ALTER COLUMN "legacyExclusivePrice" TYPE DECIMAL(14,2) USING ("legacyExclusivePrice"::numeric);

-- Previous plan DTO explicitly defined price in cents. Audit old seed/manual values first.
ALTER TABLE "subscribes" ALTER COLUMN "price" TYPE DECIMAL(14,2) USING ("price"::numeric / 100);

ALTER TABLE "orders" RENAME COLUMN "subtotalCents" TO "subtotal";
ALTER TABLE "orders" ALTER COLUMN "subtotal" TYPE DECIMAL(14,2) USING ("subtotal"::numeric / 100);
ALTER TABLE "orders" RENAME COLUMN "discountCents" TO "discount";
ALTER TABLE "orders" ALTER COLUMN "discount" TYPE DECIMAL(14,2) USING ("discount"::numeric / 100);
ALTER TABLE "orders" RENAME COLUMN "totalAmountCents" TO "totalAmount";
ALTER TABLE "orders" ALTER COLUMN "totalAmount" TYPE DECIMAL(14,2) USING ("totalAmount"::numeric / 100);
ALTER TABLE "orders" RENAME COLUMN "walletUsedCents" TO "walletUsed";
ALTER TABLE "orders" ALTER COLUMN "walletUsed" TYPE DECIMAL(14,2) USING ("walletUsed"::numeric / 100);
ALTER TABLE "orders" RENAME COLUMN "cardPaidCents" TO "cardPaid";
ALTER TABLE "orders" ALTER COLUMN "cardPaid" TYPE DECIMAL(14,2) USING ("cardPaid"::numeric / 100);

ALTER TABLE "order_items" RENAME COLUMN "originalPriceCents" TO "originalPrice";
ALTER TABLE "order_items" ALTER COLUMN "originalPrice" TYPE DECIMAL(14,2) USING ("originalPrice"::numeric / 100);
ALTER TABLE "order_items" RENAME COLUMN "discountCents" TO "discount";
ALTER TABLE "order_items" ALTER COLUMN "discount" TYPE DECIMAL(14,2) USING ("discount"::numeric / 100);
ALTER TABLE "order_items" RENAME COLUMN "pricePaidCents" TO "pricePaid";
ALTER TABLE "order_items" ALTER COLUMN "pricePaid" TYPE DECIMAL(14,2) USING ("pricePaid"::numeric / 100);

-- Historical UserLead.pricePaid was an integer-cent purchase snapshot.
ALTER TABLE "user_leads" ALTER COLUMN "pricePaid" TYPE DECIMAL(14,2) USING ("pricePaid"::numeric / 100);

-- The wallet schema was already synced with db push; retain its safety constraint too.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_walletBalance_nonnegative' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_walletBalance_nonnegative" CHECK ("walletBalance" >= 0);
  END IF;
END $$;
COMMIT;

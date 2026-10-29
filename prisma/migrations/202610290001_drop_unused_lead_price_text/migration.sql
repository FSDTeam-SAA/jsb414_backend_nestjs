BEGIN;
SET LOCAL lock_timeout = '5s';

-- Pricing uses category base prices and age rules; this legacy field is unused.
ALTER TABLE "leads" DROP COLUMN "price";

COMMIT;

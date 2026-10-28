-- Requested removal of unused legacy prices. Category remains the pricing source.
-- Local values were backed up before applying; no lead rows are deleted.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "leads"
  DROP COLUMN "legacySharedPrice",
  DROP COLUMN "legacyExclusivePrice";
COMMIT;

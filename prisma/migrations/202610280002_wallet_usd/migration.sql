-- USD wallet conversion. Stop writes and back up first; see docs/WALLET-USD.bn.md.
-- Existing Payment.amount is ALREADY dollars: never divide that column by 100.
BEGIN;

LOCK TABLE "users", "payments", "wallet_transactions" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "walletBalanceCents" < 0) THEN
    RAISE EXCEPTION 'Negative legacy balances require reconciliation before conversion';
  END IF;
  IF EXISTS (SELECT 1 FROM "payments" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'Invalid payment amounts require reconciliation before conversion';
  END IF;
END $$;

ALTER TABLE "users" RENAME COLUMN "walletBalanceCents" TO "walletBalance";
ALTER TABLE "users" ALTER COLUMN "walletBalance" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "walletBalance" TYPE DECIMAL(14,2)
  USING ("walletBalance"::numeric / 100);
ALTER TABLE "users" ALTER COLUMN "walletBalance" SET DEFAULT 0;
ALTER TABLE "users" ADD CONSTRAINT "users_walletBalance_nonnegative" CHECK ("walletBalance" >= 0);

ALTER TABLE "wallet_transactions" RENAME COLUMN "amountCents" TO "amount";
ALTER TABLE "wallet_transactions" ALTER COLUMN "amount" TYPE DECIMAL(14,2)
  USING ("amount"::numeric / 100);
ALTER TABLE "wallet_transactions" ALTER COLUMN "balanceAfter" TYPE DECIMAL(14,2)
  USING ("balanceAfter"::numeric / 100);
ALTER TABLE "wallet_transactions" ADD COLUMN "operationKey" TEXT;
ALTER TABLE "wallet_transactions" ADD COLUMN "actorId" TEXT;
CREATE UNIQUE INDEX "wallet_transactions_operationKey_key" ON "wallet_transactions"("operationKey");

ALTER TABLE "payments" ALTER COLUMN "amount" TYPE DECIMAL(14,2)
  USING round("amount"::numeric, 2);
ALTER TABLE "payments" ADD COLUMN "fundingRequestKey" TEXT;
CREATE UNIQUE INDEX "payments_fundingRequestKey_key" ON "payments"("fundingRequestKey");
CREATE UNIQUE INDEX "payments_stripeSessionId_key" ON "payments"("stripeSessionId");

COMMIT;

# Wallet: USD input, storage and response

LOCAL STATUS UPDATE: the localhost/jsb414 database now matches the current dollar schema. See LOCAL-PRICE-MIGRATION-2026-10-28.bn.md for the completed backup, migration-history reconciliation and price repair. No reset or repeat conversion is required locally.

Updated 28 October 2026. Wallet remains prepaid business account credit, as in the existing product. It is not a bank account, escrow, safeguarded custody account or protection from the business owner. A top-up charges the customer and credits the business's Stripe balance; subsequent lead purchases spend the local account credit. This change introduces no payouts/withdrawals or indefinite card authorization holds.

## 1. What changed

All wallet values in the database/API are USD dollars:

| Value | Request | Payment.amount | User.walletBalance increment | WalletTransaction.amount | Stripe only |
|---|---|---|---|---|---|
| $2 | 2 | 2.00 | 2.00 | 2.00 | 200 cents |
| $2.50 | 2.50 | 2.50 | 2.50 | 2.50 | 250 cents |
| $1000 | 1000 | 1000.00 | 1000.00 | 1000.00 | 100000 cents |

PostgreSQL numeric columns display e.g. `2.00`; this is $2, not 200. JSON numbers do not preserve trailing zeros: `2.50` may return `2.5`. Use formattedBalance for `$2.50` display. Database types are Decimal(14,2), not binary Float.

- `User.walletBalanceCents` -> `walletBalance` (Decimal USD).
- `WalletTransaction.amountCents` -> `amount` (Decimal USD).
- `WalletTransaction.balanceAfter` is now Decimal USD.
- `Payment.amount` was already dollars; converted Float -> Decimal without dividing by 100.
- Wallet responses omit cents fields; Cart balance and price summary responses use dollars too.
- UPDATE: the later ALL-PRICES-USD.bn.md change also converts category/age/plan/order/purchase pricing to USD using its own reviewed migration. Follow that document's current field names and migration rules. This wallet document's original scope was wallet-only; Order checkout is still not implemented.

## 2. Beginner-friendly code map

`src/app/helper/usd.ts`: validates exact two-decimal dollar amounts and converts to cents ONLY for Stripe.

`wallet/dto/create-wallet.dto.ts`: amount is JSON number, $1-$10,000, at most two decimals; requestId is an optional UUID v4. Backend generates and returns one when omitted.

`WalletService.addFunds`: pending Payment in dollars -> Stripe Checkout amount in cents -> return payment link. Never grants balance here. A repeat requestId reuses the same payment/session. Same ID with a different amount is rejected. Do not automatically create another charge if Stripe timed out; retry with the same requestId. Old uncertain requests outside 23 hours require reconciliation before recreation.

`WebhookService`: verifies original raw-body signature -> accepts only paid payment-mode WALLET_FUNDING session -> checks user, currency, session and amount -> atomically changes PENDING Payment to COMPLETED, increments wallet by dollar amount and creates one ledger entry. Duplicate delivery or the completed/async-success pair cannot credit twice. Database errors propagate so Stripe retries.

`adminAdjustBalance`: Super Admin only. Dollar amount (negative means deduct), reason, actorId and unique requestId. Serializable retry + conditional balance check prevents concurrent overdrafts. It creates ADMIN_ADJUSTMENT, not a fictitious successful card payment. Database check also disallows negative balances.

`getTransactions`: returns dollars, validates pagination/sort and hides internal operation keys/actor IDs from customers.

`src/main.ts`: rawBody: true. Webhook route: POST /api/v1/webhook/stripe. Use Snapshot events. No JWT on this route; signature verification is mandatory.

## 3. New request/response examples

For simple Swagger/frontend testing, send only `{"amount": 2}`. Backend generates a requestId and returns it with the payment link. Sending amount alone again creates a separate attempt, not a retry. To preserve retry protection, optionally create a UUID once per button action (e.g. `crypto.randomUUID()`) or reuse the ID returned from the first response. Reuse that ID on retries. If the first response was lost and no ID was supplied, the backend cannot infer that the next request is a retry. Never reuse an ID for a different amount. Admin adjustments still require their explicit requestId.

POST /api/v1/wallet/add-funds (Bearer token):

```json
{
  "amount": 2,
  "requestId": "22222222-2222-4222-8222-222222222222"
}
```

Result data includes paymentId, status, amount: 2, currency: USD and checkoutUrl. Redirect to checkoutUrl when present. COMPLETED/null URL means that attempt is already settled. PENDING/null URL can mean Checkout finished and webhook processing is pending. Refresh the balance, do not grant credit based on the redirect page.

GET /api/v1/wallet/balance:

```json
{
  "walletBalance": 2,
  "currency": "USD",
  "formattedBalance": "$2.00",
  "balanceType": "ACCOUNT_CREDIT"
}
```

POST /api/v1/wallet/admin/adjust (Super Admin token):

```json
{
  "userId": "11111111-1111-4111-8111-111111111111",
  "amount": -2,
  "requestId": "33333333-3333-4333-8333-333333333333",
  "reason": "Correct an approved account-credit adjustment"
}
```

Old `amountCents` payloads are rejected instead of silently interpreted as dollars. Update frontend field names, remove UI /100 conversions for the new wallet responses, and use currency formatting. Cart summary now uses subtotal, discount, total, walletBalance; individual prices use originalPrice, discount, finalPrice. Do not double-divide these new dollar response fields. Inventory/admin APIs still explicitly marked Cents retain their old units.

## 4. Migration: do not run blindly on an existing database

No database command or migration was applied during this change. Generated Prisma client now expects NEW columns. Deploy/start the changed app only against a migrated DB; the old DB is not compatible with the renamed columns.

Prepared migrations:

1. `0_init`: original User/Subscribe baseline (unchanged).
2. `202610280001_existing_features`: generated offline by comparing the original baseline schema with the actual PRE-CHANGE project schema. It fills missing migration history (category/lead/age/cart/order/payment/wallet/etc.). It does NOT reset/drop the database.
3. `202610280002_wallet_usd`: transactionally renames/converts wallet columns. Old 200 cents becomes 2.00 USD; 250 becomes 2.50. Payment.amount already dollars stays dollars. Adds unique Stripe session/funding request/ledger keys and nonnegative-balance check. Duplicate old Stripe session IDs or invalid legacy amounts stop migration rather than discarding records.

Before using these on an existing database:

- Stop application writes and webhook processing during the coordinated migration/release window; Stripe retries failed deliveries. Securely back up the actual DB and verify a restore on a separate DB.
- Inspect real schema AND `_prisma_migrations` using the environment owner. If tables were already added using db push, migration 2's CREATE TABLE statements must NOT be blindly replayed.
- Compare the real existing DB against the archived pre-change schema. Only if equivalent, the owner may record migration 2 as already applied using `prisma migrate resolve --applied 202610280001_existing_features`. This is a conditional operation, not a command to run without verification. Similarly confirm the original baseline is correctly recorded.
- If schema differs, resolve that drift with reviewed SQL first. No `migrate reset`, blanket `db push`, table deletion, or fake marking unapplied DDL as complete.
- Check balances/ledger totals and unique non-null Stripe session IDs. Confirm old wallet columns actually contain cents. If someone manually changed old units, reconcile those records first rather than divide blindly.
- Audit historical Payment.amount values against actual Stripe receipts. Before this fix the local code could send 2 cents for an input of 2 dollars. A PENDING record's requested amount is NOT evidence money was received. Do not repair it by marking paid or granting requested credit. Reconcile/refund/provider-confirmed settlement separately.
- For a fresh EMPTY development DB, the full migration chain is intended to build all tables then convert the wallet fields. For an existing verified DB, apply only properly reconciled pending migrations through the normal release process. Apply on a restored copy/staging first.
- After migration, old wallet total /100 must equal new total; ledger amount/balanceAfter likewise; Payment.amount must equal its old dollar value rounded to two decimals. Existing migration converts nonfinite Payment amounts only after validation; do not hide mismatches.
- Regenerate Prisma client, deploy the matching app version, restart webhook receiver and replay/reconcile undelivered paid events.

Offline schema checks/unit/HTTP tests do not prove these SQL migrations have run successfully on PostgreSQL. A migration should only be recorded as tested after a separate database restore/replay test.

## 5. Local Stripe test after migration

Use the same Stripe sandbox for secret key and webhook destination. For ngrok, configure the public HTTPS URL ending `/api/v1/webhook/stripe`; use THAT destination's whsec signing secret. Select checkout.session.completed and checkout.session.async_payment_succeeded (Snapshot). Keep backend/ngrok running.

1. Note current walletBalance (dollars).
2. Send amount 2 + fresh requestId. API must not increase balance yet.
3. Open returned Checkout URL; it must show $2.00. If not, do not pay; inspect the new request/session.
4. Pay using Stripe sandbox test card. Webhook should return 200; balance increases by exactly 2 and one TOP_UP entry of 2 appears.
5. Resend same signed event: no second credit. Retry same API request: no second Checkout/payment.
6. Try cancellation, failed payment, wrong signature, altered amount and a normal user calling admin adjustment: no credit.
7. Test $2.50 and compare DB numeric 2.50, API 2.5/formatted $2.50 and Stripe 250.

## 6. Limits of this task

This is an account-credit wallet, not escrow or customer-money custody. If the business needs safeguarded funds/withdrawable money, choose and verify an appropriate product/provider and change the business design first. Do not promise protection just because a ledger exists. Do not implement indefinite card holds as a wallet.

OrderService still has generated placeholders, so lead checkout/spending, full membership billing, refunds/disputes, robust scheduled pending-payment reconciliation and real Stripe live-mode tests remain separate work. Existing admin/data-manager/category permissions elsewhere were not broadly rewritten here.

Source of Stripe payment semantics: https://docs.stripe.com/api/checkout/sessions/create and https://docs.stripe.com/webhooks .

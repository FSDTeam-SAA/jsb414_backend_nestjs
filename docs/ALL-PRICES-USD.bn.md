# সব দাম USD dollars: সহজ API contract

LOCAL STATUS UPDATE: localhost/jsb414 was safely migrated on 28 October 2026. See LOCAL-PRICE-MIGRATION-2026-10-28.bn.md. Do not reapply the conversion or reset this database. The migration precautions below remain relevant for other/unverified environments.

Updated 28 October 2026. This replaces the older cents-based pricing instructions and the proposed separate manual lead-override API. No new Pricing module or override endpoints were added.

## একটি নিয়ম

`2` means `$2`, `2.50` means `$2.50`, `1000` means `$1000` throughout application inputs, database selling-price fields and customer responses. Database uses exact Decimal(14,2). JSON numbers may display 2.50 as 2.5; use currency formatting for trailing zeros.

Only Stripe's provider boundary uses integer minor units: $2 -> 200. The `stripeCents()` helper is internal to payment creation/verification. Do not remove that conversion or multiply/divide any frontend wallet/category/cart response by 100.

Discount percentages are still percentages: 10 means 10%, not $10. Property estimates/mortgage balance were already documented in whole dollars and were not divided by 100.

## Category owns the lead price

- No manual `priceCents` input in Lead create/update.
- Lead create/import does not copy a category price into a per-lead column.
- Admin lead responses derive sharedPrice/exclusivePrice from the current category.
- Old per-lead prices/text remain archived in the DB as legacy fields; hidden from API and ignored by pricing. No data was discarded. This intentionally stops old per-lead manual overrides affecting current prices, per the latest request. Review business approval before deploying if such overrides were previously contractual.
- Existing agePricingEnabled and AgePriceRule still work. With the switch OFF the category price is used; ON uses a matching mode-specific age rule, falling back to category price for gaps.
- Marketplace and Cart use the same simple pricing helper: category -> optional age rule -> current membership %. No copied lead override or hard-coded $20/$50 fallback.
- Paid-period membership check includes ACTIVE and CANCELLED through endDate, excludes expired periods. Marketplace is now authenticated so it can quote the signed-in customer's membership price. Saved-search results pass the same user ID.
- Prices are quotes, not purchase authorization. Final checkout must recalculate and atomically verify inventory/payment when Order checkout is implemented. Existing OrderService placeholders were not turned into a payment engine in this task.

## API fields and examples

| Feature | Fields in dollars |
|---|---|
| Category | sharedBasePrice, exclusiveBasePrice |
| Age rule | price |
| Membership plan | price (monthly dollars); discount remains percent |
| Admin lead response | sharedPrice, exclusivePrice, category.sharedBasePrice, category.exclusiveBasePrice |
| Customer Marketplace | sharedPrice, exclusivePrice (after applicable membership discount), currency USD |
| Cart item | originalPrice, discount, finalPrice |
| Cart summary | subtotal, discount, total, walletBalance |
| Wallet | amount, walletBalance, balanceAfter |
| Order model | subtotal, discount, totalAmount, walletUsed, cardPaid |
| OrderItem model | originalPrice, discount, pricePaid |
| UserLead | pricePaid |

### Category create/update

POST `/api/v1/categories/create` or PATCH `/api/v1/categories/{id}`. Existing multipart image upload still works. In Swagger enter 2.50 directly in the numeric field, not 250.

```json
{
  "name": "Mortgage Leads",
  "sharedBasePrice": 2.50,
  "exclusiveBasePrice": 10,
  "isActive": true,
  "agePricingEnabled": false
}
```

Category prices not provided are unconfigured (null), never an invented default. Explicit zero is a deliberate free price. Clients must stop sending the old ...Cents field names; whitelist validation rejects them.

### Lead create

POST `/api/v1/lead/create` (admin login): send categoryId and lead/contact/property/availability fields. NO price field is needed or accepted. The category owns it. Same rule for imports: a CSV price/customprice column does not override category pricing.

```json
{
  "categoryId": "11111111-1111-4111-8111-111111111111",
  "availability": "SHARED",
  "firstName": "Demo",
  "lastName": "Owner",
  "propertyAddress": "123 Example Street",
  "city": "Miami",
  "state": "FL",
  "zipcode": "33132",
  "phoneNumbers": ["+13055550199"]
}
```

Use an ACTUAL category UUID instead of the example. With category sharedBasePrice 2.50 and age pricing OFF: admin lead sharedPrice is 2.50; a Free customer's marketplace/cart price is 2.50. Category change to 5 immediately changes subsequent quotes for all its leads; historical paid orders stay historical.

### Age rule (existing optional feature)

POST `/api/v1/age-price`:

```json
{
  "categoryId": "11111111-1111-4111-8111-111111111111",
  "priceType": "SHARED",
  "minDays": 0,
  "maxDays": 7,
  "price": 2.50
}
```

Use agePricingEnabled false if only category prices are wanted. Age gaps fall back to category; overlapping matches fail with a clear error, not random prices.

### Membership plan

```json
{
  "title": "Silver",
  "subTitle": "Save 5% on leads",
  "price": 49,
  "discount": 5
}
```

This is $49/month, not 49 cents. Editing a local plan does not itself change an existing Stripe recurring price/subscription; recurring billing integration is separate work.

### Wallet

POST `/api/v1/wallet/add-funds`: `{"amount":2}`. requestId is optional; backend generates it. Webhook still verifies actual payment and credits once. See WALLET-USD.bn.md for retries, signed webhooks and admin adjustments.

## Migration: old records must be reviewed

The local database migration is now complete and verified; no real payment was executed. Source code and generated client expect the NEW schema. For a different database, coordinate application/webhook writes before applying reviewed changes and deploy the matching app afterward.

After the local data audit, `202610280003_all_prices_usd` preserves category/age-rule numeric values as dollars (15/49, 25/75 and 20 were entered as dollars despite the old Cents names). It renames and converts those fields to Decimal without dividing. Archived lead numeric values are retained verbatim and ignored by pricing. Subscribe.price 4900 is converted to $49; the empty order/purchase tables follow their former cent contracts. Payment.amount and the already-converted wallet are NOT divided again. The SQL runs in a transaction and does not drop price/history data. Do not reuse this local conversion policy on another database without checking its units.

**Do not blindly apply on mixed-unit data.** If an old category value 15 was manually intended as $15 despite a Cents field/old contract, the standard /100 migration would yield $0.15. Verify old records/receipts/seeds and correct the migration/backfill for those specific known records first; code cannot infer the intended unit from the number. Do not multiply/divide everything repeatedly to guess. Values consistently stored as cents (e.g. 250 = $2.50) convert normally.

The project also has prepared missing-history foundation and wallet migrations from earlier work. Follow WALLET-USD.bn.md: back up/restore a separate copy, compare the actual schema with migration history, only mark truly existing equivalent schema as applied, then apply reviewed pending migrations. No reset, blind db push, or automatic migrate deploy against an unverified existing DB. New migration is NOT safe to run twice manually.

Legacy lead fields are retained for audit only. Old saved prices on purchased UserLead/Order/OrderItem records are converted to dollars; changing category now does not rewrite a historical purchase price. No newly generated order is marked paid by this task.

## Quick verification after migration

1. Configure category sharedBasePrice 2.50 and exclusiveBasePrice 10, age pricing OFF.
2. Create an eligible lead under that category without a price input.
3. Authorize as a Free customer: Marketplace and Cart show 2.50 for Shared.
4. Change category sharedBasePrice to 5: subsequent Marketplace and Cart quotes show 5 without updating the lead.
5. Valid 10% membership: 5 -> discount 0.50 -> final 4.50; expired membership -> 5.
6. Optional age rule SHARED price 3 for matching age and switch ON: Free -> 3; 10% member -> 2.70.
7. Wallet amount 2 must show Checkout $2.00 and credit dollars 2 once after verified webhook.
8. Old API payloads priceCents/sharedBasePriceCents fail validation instead of silently treating cents as dollars.

Tests use mocked databases/payment provider or signed synthetic Stripe events. They do not establish that a real PostgreSQL migration or live Stripe payment succeeded. Cart bulk eligibility and final purchase concurrency still need end-to-end checkout work; no claim of full project completion.

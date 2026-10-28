# Local jsb414 price migration completed

28 October 2026. Target verified: localhost:5432/jsb414. No reset, table deletion or real Stripe charge was performed.

## Why db push failed

Existing age_price_rules had one required priceCents value (20), but the new model requires price. db push could not infer a safe rename/backfill and tried to add an empty required column. Reset would have destroyed unrelated data and was unnecessary.

## Audited conversion policy

- Mortgage category 15/49 -> USD 15.00/49.00, unchanged numerical values.
- Pre-Foreclosure category 25/75 -> USD 25.00/75.00, unchanged numerical values.
- Age rule 0-7 days, SHARED, 20 -> USD 20.00.
- Foreclosure Leads unconfigured null prices remain null; configure them in admin before selling.
- Silver plan 4900 (old cents) -> USD 49.00.
- Orders, order_items and user_leads had no rows. Wallet balances and payments were already dollars and were not converted again.
- Old per-lead numbers are retained verbatim in legacy columns; current pricing ignores them.

This policy is local-data-specific. A category value truly stored as 2000 cents on another database would need a different reviewed conversion to $20. Never infer currency units from the field name alone.

## Backup and verification

A PostgreSQL custom-format backup was saved outside the project repo:

`C:\Users\saurav sarkar\.codex\visualizations\2026\10\11\01a1293f-df9c-74d3-94bf-a4665bfa3205\jsb414-before-price-fix-2f82a437-e260-4d7a-bf69-6e386604fb22.dump`

Keep it private: it contains database data. A local SQL inspection copy was also exported in the same folder; it was read as text, never executed as a restore.

Before applying, migration SQL was executed in a PostgreSQL transaction and rolled back. Assertions verified all existing table row counts, unchanged wallet balances/payments, preserved category/age values and the Silver conversion.

The actual DB matched the archived pre-price schema (empty Prisma diff) and had no _prisma_migrations table. Existing equivalent migrations 0_init, 202610280001_existing_features and 202610280002_wallet_usd were recorded as already applied. Then 202610280003_all_prices_usd was applied normally with migrate deploy. The nonnegative wallet constraint was included where db push had not installed it.

After application: migrate status reports up to date; diff from live DB to current prisma/schema reports no difference. Read-only checks confirmed the exact dollar settings above. Backup comparison verified all original table row counts and unchanged wallet/payment values.

## Next commands

Database is already migrated. No force-reset, db push or manual SQL replay is needed.

```bash
npm run generate
npm run start:dev
```

For later reviewed model changes, keep proper migration history. Do not run migrate resolve merely to silence errors; it was used here only after verifying the existing schema.

This verifies the database repair. It does not establish that a real Stripe funding payment, full Order checkout or the entire application has passed live acceptance tests.

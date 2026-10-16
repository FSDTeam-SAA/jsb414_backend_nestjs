#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_TEST_DATABASE_URL:?Set a dedicated, empty restore-test database URL}"
: "${1:?Pass a backup dump file}"
# Refuse to touch any database that already has user tables.
export PGDATABASE="$RESTORE_TEST_DATABASE_URL"
unset RESTORE_TEST_DATABASE_URL
table_count="$(psql -X -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type = 'BASE TABLE'")"
if [[ "$table_count" != "0" ]]; then
  echo "Restore test requires an empty database" >&2
  exit 1
fi
pg_restore --no-owner --no-acl --single-transaction --dbname="$PGDATABASE" "$1"
echo "Restore completed. Verify row counts and application behavior in this test database."

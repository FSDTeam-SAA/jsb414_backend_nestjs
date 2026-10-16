#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${BACKUP_DATABASE_URL:?Set a PostgreSQL backup connection URL}"
: "${BACKUP_DIR:?Set an absolute backup directory}"
if [[ "$BACKUP_DIR" != /* ]]; then
  echo "BACKUP_DIR must be an absolute path" >&2
  exit 1
fi
command -v pg_dump >/dev/null
command -v pg_restore >/dev/null
mkdir -p "$BACKUP_DIR"
backup_file="$BACKUP_DIR/backup-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
# Environment variable avoids putting the connection URL in process arguments.
export PGDATABASE="$BACKUP_DATABASE_URL"
unset BACKUP_DATABASE_URL
if ! pg_dump --format=custom --file="$backup_file"; then
  rm -f -- "$backup_file"
  echo "Backup failed" >&2
  exit 1
fi
pg_restore --list "$backup_file" >/dev/null
echo "Backup created: $backup_file"
# Keep retention and off-server upload explicit: never silently delete backups.

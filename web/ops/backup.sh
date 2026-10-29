#!/usr/bin/env bash
# Logical backup of the Supabase Postgres database (schema + data, public and auth schemas).
# Usage: SUPABASE_DB_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' ./ops/backup.sh [out_dir]
# Restore:  gunzip -c backup.sql.gz | psql "$TARGET_DB_URL"
set -euo pipefail
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL (Project Settings > Database > Connection string, session pooler or direct)}"
out_dir="${1:-.}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="${out_dir}/phoolghar-${stamp}.sql.gz"
mkdir -p "$out_dir"
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges --schema=public --schema=auth --schema=storage | gzip -9 > "$file"
test -s "$file" || { echo "backup is empty" >&2; exit 1; }
echo "$file"

#!/usr/bin/env bash
# Sauvegarde PostgreSQL Isoko Hub (chiffrement au repos = responsabilité hébergeur / disque).
# Usage: ./scripts/backup_postgres.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$ROOT/backups/pg_${STAMP}.sql.gz"

cd "$ROOT"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$OUT"
echo "PostgreSQL dump: $OUT"

#!/bin/sh
# Rappels départ hôtel J-1 — à lancer quotidiennement (cron / sidecar).
set -eu
cd "$(dirname "$0")/../.."
exec python manage.py notify_hotel_departures "$@"

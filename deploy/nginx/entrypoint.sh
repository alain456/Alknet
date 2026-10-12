#!/bin/sh
set -eu
if ! command -v openssl >/dev/null 2>&1; then
  apk add --no-cache openssl
fi
mkdir -p /etc/nginx/certs
if [ ! -f /etc/nginx/certs/tls.crt ] || [ ! -f /etc/nginx/certs/tls.key ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout /etc/nginx/certs/tls.key \
    -out /etc/nginx/certs/tls.crt \
    -subj "/CN=isoko-hub.local"
fi
exec nginx -g 'daemon off;'

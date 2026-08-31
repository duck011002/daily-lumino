#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
config_file="${LUMINO_NGINX_CONFIG:-/etc/nginx/conf.d/lumino.conf}"
backup_dir="${LUMINO_NGINX_BACKUP_DIR:-/opt/backups/lumino-nginx-performance}"
rendered_file="$(mktemp)"
trap 'rm -f -- "$rendered_file"' EXIT

python3 "$repo_dir/scripts/apply-nginx-performance.py" "$config_file" "$rendered_file"

if cmp -s "$config_file" "$rendered_file"; then
  echo "Nginx performance configuration is already current."
  exit 0
fi

mkdir -p "$backup_dir"
backup_file="$backup_dir/lumino.conf.$(date -u +%Y%m%dT%H%M%SZ)"
cp --preserve=all "$config_file" "$backup_file"
install -m 0644 "$rendered_file" "$config_file"

if ! nginx -t; then
  cp --preserve=all "$backup_file" "$config_file"
  nginx -t
  echo "Nginx validation failed; restored $backup_file" >&2
  exit 1
fi

systemctl reload nginx
echo "Nginx performance configuration applied; backup: $backup_file"

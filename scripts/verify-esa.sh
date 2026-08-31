#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-https://lovestory1314.fun}"
base_url="${base_url%/}"

work_dir="$(mktemp -d)"
trap 'rm -rf -- "$work_dir"' EXIT

header_value() {
  local file="$1"
  local name="$2"
  awk -v header="$name" '
    {
      prefix = tolower(header) ":"
      if (index(tolower($0), prefix) == 1) {
        value = substr($0, length(header) + 2)
        sub(/^[[:space:]]*/, "", value)
      }
    }
    END { print value }
  ' "$file" | tr -d '\r'
}

fetch_headers() {
  local path="$1"
  local output="$2"
  curl \
    --silent \
    --show-error \
    --compressed \
    --connect-timeout 10 \
    --max-time 30 \
    --output /dev/null \
    --dump-header "$output" \
    "${base_url}${path}"
}

assert_contains() {
  local value="$1"
  local expected="$2"
  local label="$3"
  if [[ "${value,,}" != *"${expected,,}"* ]]; then
    echo "FAIL ${label}: expected '${expected}', got '${value}'" >&2
    exit 1
  fi
}

verify_dynamic_path() {
  local path="$1"
  local require_private="${2:-false}"
  local headers="$work_dir/headers"
  fetch_headers "$path" "$headers"

  local server via cache_control site_status
  server="$(header_value "$headers" "Server")"
  via="$(header_value "$headers" "Via")"
  cache_control="$(header_value "$headers" "Cache-Control")"
  site_status="$(header_value "$headers" "X-Site-Cache-Status")"

  assert_contains "$server" "ESA" "${path} server"
  assert_contains "$via" "ens-" "${path} via"
  assert_contains "$cache_control" "no-store" "${path} cache-control"
  assert_contains "$site_status" "DYNAMIC" "${path} ESA status"
  if [[ "$require_private" == "true" ]]; then
    assert_contains "$cache_control" "private" "${path} private cache-control"
  fi

  echo "PASS dynamic ${path}"
}

verify_eventual_static_hit() {
  local path="$1"
  local expected_max_age="$2"
  local headers="$work_dir/static-headers"
  local site_status=""

  for _ in 1 2 3 4; do
    fetch_headers "$path" "$headers"
    site_status="$(header_value "$headers" "X-Site-Cache-Status")"
    if [[ "${site_status^^}" == *"HIT"* ]]; then
      break
    fi
  done

  local cache_control
  cache_control="$(header_value "$headers" "Cache-Control")"
  assert_contains "$cache_control" "public" "${path} public cache-control"
  assert_contains "$cache_control" "max-age=${expected_max_age}" "${path} max-age"
  assert_contains "$cache_control" "immutable" "${path} immutable"
  assert_contains "$site_status" "HIT" "${path} ESA status"

  echo "PASS static ${path}"
}

for path in / /library /blog /sw.js; do
  verify_dynamic_path "$path"
done

for path in /api/health /api/site/profile /api/blog/featured; do
  verify_dynamic_path "$path" true
done

verify_eventual_static_hit "/icons/icon-192.png" "2592000"

root_html="$work_dir/root.html"
curl --silent --show-error --compressed --output "$root_html" "${base_url}/"
next_static_path="$(grep -oE '/_next/static/[^" ]+\.(js|css)' "$root_html" | head -n 1 || true)"
if [[ -z "$next_static_path" ]]; then
  echo "FAIL could not discover a Next.js static asset from the root page" >&2
  exit 1
fi
verify_eventual_static_hit "$next_static_path" "31536000"

echo "ESA verification passed for ${base_url}"

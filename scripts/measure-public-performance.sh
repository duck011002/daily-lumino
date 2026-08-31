#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-https://lovestory1314.fun}"
runs="${2:-5}"

if ! [[ "$runs" =~ ^[1-9][0-9]*$ ]] || (( runs > 20 )); then
  echo "runs must be an integer between 1 and 20" >&2
  exit 2
fi

base_url="${base_url%/}"
paths=(
  "/"
  "/library"
  "/blog"
  "/api/health"
  "/api/site/profile"
  "/api/blog/featured"
  "/api/blog/posts-page?page=1&page_size=9"
  "/sw.js"
  "/icons/icon-192.png"
)

work_dir="$(mktemp -d)"
trap 'rm -rf -- "$work_dir"' EXIT

printf 'path\truns\tp50_ttfb_s\tp95_ttfb_s\tp50_total_s\tp95_total_s\tbytes\n'

for path in "${paths[@]}"; do
  result_file="$work_dir/results.tsv"
  : > "$result_file"

  for ((run = 1; run <= runs; run += 1)); do
    result="$({
      curl \
        --silent \
        --show-error \
        --compressed \
        --connect-timeout 10 \
        --max-time 30 \
        --output /dev/null \
        --write-out '%{http_code}\t%{time_starttransfer}\t%{time_total}\t%{size_download}\n' \
        "${base_url}${path}"
    })"
    status="${result%%$'\t'*}"
    if [[ "$status" != "200" ]]; then
      echo "unexpected HTTP status for ${path}: ${status}" >&2
      exit 1
    fi
    printf '%s\n' "$result" >> "$result_file"
  done

  p50_index=$(( (50 * runs + 99) / 100 ))
  p95_index=$(( (95 * runs + 99) / 100 ))
  p50_ttfb="$(cut -f2 "$result_file" | sort -n | sed -n "${p50_index}p")"
  p95_ttfb="$(cut -f2 "$result_file" | sort -n | sed -n "${p95_index}p")"
  p50_total="$(cut -f3 "$result_file" | sort -n | sed -n "${p50_index}p")"
  p95_total="$(cut -f3 "$result_file" | sort -n | sed -n "${p95_index}p")"
  bytes="$(tail -n 1 "$result_file" | cut -f4)"

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$path" "$runs" "$p50_ttfb" "$p95_ttfb" "$p50_total" "$p95_total" "$bytes"
done

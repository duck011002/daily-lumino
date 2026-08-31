#!/usr/bin/env bash
set -euo pipefail

repo_dir="/opt/lumino"
lock_file="/tmp/lumino-production-deploy.lock"

exec 9>"$lock_file"
if ! flock -n 9; then
  echo "Refusing deployment: another production deployment is already running." >&2
  exit 75
fi

cd "$repo_dir"

current_branch="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ "$current_branch" != "master" ]]; then
  echo "Refusing deployment: production must be on master." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Refusing deployment: tracked production source has local changes." >&2
  exit 1
fi

if [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "Refusing deployment: production contains untracked source files." >&2
  exit 1
fi

old_head="${LUMINO_DEPLOY_BASE:-$(git rev-parse HEAD)}"
git cat-file -e "$old_head^{commit}"
git fetch origin master:refs/remotes/origin/master
git merge --ff-only origin/master
new_head="$(git rev-parse HEAD)"

if [[ "$old_head" == "$new_head" ]]; then
  echo "Production is already at $new_head."
  exit 0
fi

changed_files="$(git diff --name-only "$old_head" "$new_head")"
backend_changed=0
frontend_changed=0
frontend_swapped=0

if grep -q '^ops/logrotate/lumino-pm2$' <<<"$changed_files" || [[ ! -f /etc/logrotate.d/lumino-pm2 ]]; then
  install -m 0644 "$repo_dir/ops/logrotate/lumino-pm2" /etc/logrotate.d/lumino-pm2
fi

if grep -q '^backend/' <<<"$changed_files"; then
  backend_changed=1
fi

if grep -q '^frontend/' <<<"$changed_files"; then
  frontend_changed=1
fi

if (( backend_changed )); then
  cd "$repo_dir/backend"
  if grep -q '^backend/requirements.txt$' <<<"$changed_files"; then
    nice -n 10 .venv/bin/pip install -q -r requirements.txt
  else
    echo "Backend dependencies unchanged; skipping pip install."
  fi
  .venv/bin/alembic upgrade head

  if [[ "${LUMINO_DEPLOY_RUN_TESTS:-0}" == "1" ]]; then
    nice -n 10 .venv/bin/python -m pytest -q
  else
    echo "Production tests skipped; run them locally before deployment."
  fi
else
  echo "Backend unchanged; skipping backend install, migration, and restart."
fi

if (( frontend_changed )); then
  cd "$repo_dir/frontend"
  if grep -q '^frontend/package-lock.json$' <<<"$changed_files" || [[ ! -f node_modules/.package-lock.json ]]; then
    nice -n 15 ionice -c3 npm ci --prefer-offline --no-audit --no-fund
  else
    echo "Frontend dependencies unchanged; skipping npm ci."
  fi

  export NEXT_TELEMETRY_DISABLED=1
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1024}"
  frontend_dir="$(pwd -P)"
  next_build_dir="$frontend_dir/.next-build"
  next_live_dir="$frontend_dir/.next"
  next_previous_dir="$frontend_dir/.next-previous"
  for managed_dir in "$next_build_dir" "$next_live_dir" "$next_previous_dir"; do
    case "$managed_dir" in
      "$frontend_dir"/.next*) ;;
      *)
        echo "Refusing deployment: unsafe Next.js directory $managed_dir" >&2
        exit 1
        ;;
    esac
  done

  rm -rf -- "$next_build_dir"
  NEXT_DIST_DIR=.next-build nice -n 15 ionice -c3 npm run build

  pm2 stop lumino-frontend
  rm -rf -- "$next_previous_dir"
  if [[ -d "$next_live_dir" ]]; then
    mv -- "$next_live_dir" "$next_previous_dir"
  fi
  mv -- "$next_build_dir" "$next_live_dir"
  frontend_swapped=1
else
  echo "Frontend unchanged; skipping frontend install, build, and restart."
fi

cd "$repo_dir"
services=()
(( backend_changed )) && services+=(lumino-backend)
(( frontend_changed )) && services+=(lumino-frontend)

if (( ${#services[@]} > 0 )); then
  pm2 restart "${services[@]}" --update-env
fi

healthy=0
for _ in {1..12}; do
  if curl --fail --silent --show-error --max-time 10 \
    http://127.0.0.1:3000/api/health >/dev/null; then
    healthy=1
    break
  fi
  sleep 5
done

if (( ! healthy )); then
  if (( frontend_swapped )) && [[ -d "$next_previous_dir" ]]; then
    echo "Frontend health check failed; restoring the previous Next.js build." >&2
    pm2 stop lumino-frontend || true
    failed_dir="$frontend_dir/.next-failed-$new_head"
    rm -rf -- "$failed_dir"
    mv -- "$next_live_dir" "$failed_dir"
    mv -- "$next_previous_dir" "$next_live_dir"
    pm2 restart lumino-frontend --update-env
  fi
  echo "Deployment completed, but the local health check did not recover in time." >&2
  exit 1
fi

if grep -Eq '^scripts/(apply-nginx-performance.py|configure-nginx-performance.sh)$' <<<"$changed_files"; then
  "$repo_dir/scripts/configure-nginx-performance.sh"
fi

git status --short --branch
git rev-parse HEAD

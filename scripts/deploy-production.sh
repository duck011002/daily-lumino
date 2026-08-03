#!/usr/bin/env bash
set -euo pipefail

repo_dir="/opt/lumino"
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

git fetch origin master:refs/remotes/origin/master
git merge --ff-only origin/master

cd "$repo_dir/backend"
.venv/bin/pip install -q -r requirements.txt
.venv/bin/alembic upgrade head
.venv/bin/python -m pytest -q

cd "$repo_dir/frontend"
npm ci --no-audit --no-fund
npm run build

cd "$repo_dir"
pm2 restart lumino-backend lumino-frontend --update-env
curl --fail --silent --show-error --max-time 15 \
  https://lovestory1314.fun/api/health >/dev/null

git status --short --branch
git rev-parse HEAD

---
id: operations/production-deployment
type: runbook
status: implemented
source_of_truth: docs/operations/current.md
last_reviewed_at: 2026-08-28
---

# Lumino Production Deployment Runbook

> This is the authoritative runbook for production code deployment. Dated release notes and historical plans do not override it.

Use this checklist after code has passed local tests and has been pushed to
`master`. Do not place passwords, API tokens, or database
credentials in this document.

## Production Layout

- Server application directory: `/opt/lumino`
- Backend working directory: `/opt/lumino/backend`
- Backend Python environment: `/opt/lumino/backend/.venv`
- Alembic configuration: `/opt/lumino/backend/alembic.ini`
- Processes: `lumino-backend` and `lumino-frontend`, supervised by PM2
- Public health check: `https://lovestory1314.fun/api/health`

## Required deployment entry point

All production deployments must run from a clean `master` branch through:

```bash
cd /opt/lumino
./scripts/deploy-production.sh
```

The script refuses detached heads, non-master branches, tracked changes,
untracked source files, and non-fast-forward updates. Do not copy application
source to production with SCP, SFTP, rsync, or direct editor changes.

## Standard Release

1. Verify the local branch is clean, tests pass, and the intended commit is
   pushed.
2. Confirm the intended commit is the remote `master` head without detaching
   production from its branch:

   ```bash
   cd /opt/lumino
   git fetch origin master
   git status --short --branch
   git rev-parse origin/master
   ```

3. Run the guarded deployment entry point. It performs a fast-forward update,
   dependency install when required, Alembic migration, frontend build,
   selective PM2 restart, and local health check:

   ```bash
   cd /opt/lumino
   ./scripts/deploy-production.sh
   ```

4. For the unified AI/ledger/MCP release, complete the release-specific
   smoke checks after the script succeeds:

   - follow `docs/operations/2026-08-19-unified-ai-ledger-mcp-release.md`;
   - verify the admin user list and AI provider self-check;
   - verify a draft update does not change its publication state;
   - do not use real private content for smoke tests.

## Important Notes

- The server's Git version may not support `git restore`. Frontend builds can
  regenerate tracked PWA files such as `frontend/public/sw.js`; this does not
  affect the running release. Do not use destructive Git commands to clean the
  server blindly.
- Keep server-only environment backups and `.env` files intact. A deployment
  must not overwrite secrets with repository defaults.
- If a migration command cannot find Alembic, use the backend environment path
  above, not a guessed top-level virtual environment path.
- For an upload or MCP release, test the public endpoint after restart instead
  of relying only on a local result.

# Lumino Production Deployment Runbook

Use this checklist after code has passed local tests and has been pushed to
`codex/sync-server-20260727`. Do not place passwords, API tokens, or database
credentials in this document.

## Production Layout

- Server application directory: `/opt/lumino`
- Backend working directory: `/opt/lumino/backend`
- Backend Python environment: `/opt/lumino/backend/.venv`
- Alembic configuration: `/opt/lumino/backend/alembic.ini`
- Processes: `lumino-backend` and `lumino-frontend`, supervised by PM2
- Public health check: `https://lovestory1314.fun/api/health`

## Standard Release

1. Verify the local branch is clean, tests pass, and the intended commit is
   pushed.
2. Connect to the server, fetch the branch, and check out the exact commit:

   ```bash
   cd /opt/lumino
   git fetch origin codex/sync-server-20260727
   git checkout <commit-sha>
   ```

3. Run the migration whenever the release contains a new Alembic revision:

   ```bash
   cd /opt/lumino/backend
   .venv/bin/alembic upgrade head
   ```

4. Build the frontend whenever `frontend/` changed:

   ```bash
   cd /opt/lumino/frontend
   npm run build
   ```

5. Restart both processes after backend or frontend changes:

   ```bash
   cd /opt/lumino
   pm2 restart lumino-backend lumino-frontend --update-env
   pm2 status
   ```

6. Verify externally:

   ```bash
   curl -i https://lovestory1314.fun/api/health
   curl -i https://lovestory1314.fun/
   ```

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

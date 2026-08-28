# Repository Guidelines

## Project Structure & Module Organization

- `backend/app/` contains the FastAPI application, routers, services, models, schemas, and MCP integrations.
- `backend/tests/` contains API and service regression tests; `backend/alembic/` contains database migrations.
- `frontend/src/` contains the Next.js app, pages, components, hooks, and API helpers; static assets live in `frontend/public/`.
- `mobile-app/` is a **separate uni-app Vue 3 Android client** that shares backend data but is NOT deployed by `deploy-production.sh`; its API base lives in `mobile-app/services/api.js`.
- Operational notes, release checklists, and architecture decisions live under `docs/` (plans/designs in `docs/superpowers/`).
- Use `scripts/deploy-production.sh` for production releases. Do not commit `.env` files, tokens, passwords, or generated build output.

## Architecture Notes

- The app mounts **three MCP servers** (`/api/mcp/blog`, `/api/mcp/library`, `/api/mcp/lumino`) and runs `invite_request` / `visit_analytics` background workers, all started in the `lifespan` of `backend/app/main.py`.
- Chat messages are routed through an LLM `PrivateAgentRouter` (`backend/app/services/private_agent_router.py`); web blog writes become **confirmable proposals** (`action_proposals.py`) rather than direct posts. Permission contexts are trimmed per-user (`blog` needs writer permission, `library` is root-only).
- Alembic reads its DB URL from app settings (`backend/alembic/env.py` → `settings.database_url`), not from `alembic.ini`. New models/tables require a new migration and must keep a single Alembic head.

## Build, Test, and Development Commands

Backend, from `backend/` (use the local venv; tests mock their own env so they run without `.env`):

```bash
venv/Scripts/python.exe -m pytest -q   # run the full backend suite (Windows); .venv/bin on Linux
venv/Scripts/python.exe -m pytest -q tests/test_auth.py        # run a single test file
venv/Scripts/python.exe -m ruff check . # lint Python
venv/Scripts/python.exe -m black --check . # verify formatting
venv/Scripts/python.exe -m alembic heads  # confirm a single migration head
```

To run the API or generate migrations it needs a real DB, so first copy `backend/.env.example` to `backend/.env` (gitignored) and fill in `DB_*`/`JWT_SECRET`. Then `venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000`.

Frontend, from `frontend/`:

```bash
npm ci                       # install the lockfile dependencies
npm run dev                  # start Next.js development mode
npx tsc --noEmit             # type-check (no `typecheck` script exists)
npm run lint                 # run Next.js ESLint checks
npm run build                # create a production build
```

**Gotcha:** `next.config.js` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` to `true`, so `npm run build` will pass even with TS/lint errors. Run `npx tsc --noEmit` and `npm run lint` explicitly (before `build`) to actually validate. The frontend also rewrites `/api/*` to `LUMINO_API_ORIGIN` (default `http://127.0.0.1:8000`).

## Coding Style & Naming Conventions

Python targets 3.12, uses Black and Ruff with a 100-character line limit, four-space indentation, `snake_case` functions/modules, and `PascalCase` classes. TypeScript/React uses two-space indentation, `PascalCase` components, and `camelCase` variables/hooks. Keep API contracts in `schemas/` and business logic in services rather than embedding it in routers.

## Testing Guidelines

Name backend tests `test_*.py` and test behavior through FastAPI’s `TestClient` where practical. Tests use an isolated in-memory SQLite database and mocked environment settings; never point them at production. Add focused regression coverage for authorization, user isolation, token lifecycle, MCP idempotency, and migrations when changing those areas.

## Commit & Pull Request Guidelines

Use concise Conventional Commit-style subjects such as `feat: ...`, `fix: ...`, and `docs: ...`. Keep commits focused. Pull requests should describe the behavior change, list test commands and migration impact, link relevant release/issue documentation, and include screenshots for UI changes. Call out deployment or configuration changes explicitly and confirm that no secrets or production data are included.

## Security & Deployment

Keep credentials in environment variables or deployment-side secret storage. Before release, run local tests, push the intended clean `master` commit, then follow `docs/operations/production-deployment-runbook.md`; production must be updated only through `/opt/lumino/scripts/deploy-production.sh`.

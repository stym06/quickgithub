# QuickGitHub

## Database Access

- **Local dev database** runs via Docker Compose (postgres:16-alpine) on **port 5433**
- Connection string: `postgresql://quickgithub:quickgithub_dev@localhost:5433/quickgithub`
- Connect with: `psql "postgresql://quickgithub:quickgithub_dev@localhost:5433/quickgithub"`
- Migrations: `cd web && npx prisma migrate dev`
- Migration files live in `web/prisma/migrations/`
- Prisma schema: `web/prisma/schema.prisma`
- After schema changes, run `npx prisma generate` to regenerate the client

## Project Structure

- `web/` — Next.js frontend (TypeScript, Tailwind v4, shadcn/ui)
- `worker-py/` — Python worker (Claude Agent SDK, arq task queue, asyncpg)
- `docker-compose.yml` — PostgreSQL (port 5433), Redis (port 6379), Grafana OTEL

## Python Worker

- **Always activate the venv** before running any Python commands in `worker-py/`: `source worker-py/.venv/bin/activate`
- Example: `source worker-py/.venv/bin/activate && python -c "..."`
- Install deps: `source worker-py/.venv/bin/activate && pip install -e .`

## Common Commands

- `make dev` — Start Next.js dev server
- `make worker` — Start Python worker
- `make docker-up` — Start Docker services (Postgres, Redis, OTEL)
- `make setup` — Full local setup (Docker + deps + migrations)
- `make deploy` — Deploy both worker and web

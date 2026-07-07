# Architecture

The dashboard is a React SPA backed by a Node API. Postgres hosts the stats; we use a thin BFF layer (`server/api`) for the React Query data fetches. Build pipeline is Vite + esbuild.

Module boundaries:
- `src/components/` — UI components
- `src/lib/api/` — data fetching (React Query)
- `server/` — BFF + Postgres queries
- `server/migrations/` — DB schema

Data flow: React → React Query → BFF → Postgres.

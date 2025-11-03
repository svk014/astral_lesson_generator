<h1 align="center">Astral Lesson Generator</h1>

<p align="center">
Temporal-powered lesson generation with Supabase persistence, Gemini authoring, and a rapid iteration harness.
</p>

## Overview

Astral Lesson Generator turns a plain-language outline into a JSX lesson component and stores the results in Supabase. The workflow today includes:

- A Next.js 16 App Router UI (`app/page.tsx`) to submit outlines and monitor status.
- API route handlers that persist lessons and expose run output.
- Temporal workflows (`lib/temporal/workflows.ts`) orchestrating Gemini calls, validation, storage, and logging.
- A CLI harness (`bun run harness`) to iterate on prompt → JSX generation locally without touching Temporal or the database.

Generation logs are captured in the `lesson_generation_logs` table so you can trace each attempt directly inside Supabase or the lesson detail page.

## Tech Stack

- [Next.js 16 App Router](https://nextjs.org/docs/app)
- [Bun](https://bun.sh/) for dependency and script management
- [Supabase](https://supabase.com/) Postgres + Storage
- [Temporal](https://temporal.io/) JavaScript SDK (workflows + worker)
- [Google Gemini](https://ai.google.dev/) for JSX authoring
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Zod](https://zod.dev/) for validating Gemini JSON responses

## Prerequisites

- Node.js ≥ 18 (Bun includes one, Temporal tooling also requires a modern runtime)
- [Bun](https://bun.sh/docs/installation)
- [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations and status checks
- Temporal Cloud/Dev environment credentials (address, namespace, optional API key)
- Gemini API key with access to the configured model

## Quick Start

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Copy environment config**

   ```bash
   cp .env.example .env.local
   ```

   Populate Supabase, Temporal, and Gemini keys (see [Environment variables](#environment-variables)).

3. **Apply database migrations**

   ```bash
   supabase db push --linked
   ```

4. **Run the app**

   ```bash
   bun run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000) to submit outlines.

5. **Start the Temporal worker** (separate terminal)

   ```bash
   bun run worker
   ```

## Environment variables

All variables are documented in `.env.example`. Core settings include:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project REST endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key for client-side data fetching |
| `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PRIVATE_SUPABASE_SECRET_KEY` | Service role key used by server-side inserts/updates |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket for JSX artifacts (defaults to `lessons`) |
| `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_TASK_QUEUE` | Temporal connection details for worker + client |
| `TEMPORAL_API_KEY` | Optional Temporal Cloud API key |
| `GEMINI_API_KEY` | API key for Google Generative AI |
| `GEMINI_MODEL` | Gemini model identifier (defaults to `gemini-2.5-pro`) |

## Database migrations

Migration SQL files live under `supabase/migrations`. The current schema includes `lessons` plus `lesson_generation_logs` for per-step run telemetry.

- Create: `supabase migration new <name>`
- Apply (linked project): `supabase db push --linked`
- Sync to local dev stack: `supabase db reset`
- Inspect history: `supabase migration list --linked`

Commit each migration alongside the feature that depends on it so environments stay aligned.

## Development scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Next.js dev server with Turbopack |
| `bun run build` | Production build (linted & type-checked) |
| `bun run lint` | ESLint + TypeScript lint rules |
| `bun run worker` | Temporal worker executing activities/workflows |
| `bun run harness` | Local Gemini-to-JSX harness (no Temporal/Supabase) |

## Rapid JSX harness

Use the harness to iterate on prompts without hitting Temporal:

```bash
# Inline outline text
bun run harness --outline "Explain stellar nucleosynthesis for grade 9 students."

# Or point to a file
bun run harness --outline-file sandbox/outline.md
```

Artifacts are written to `sandbox/output.jsx` and `sandbox/logs.json`. The harness uses the same shared generation runner as the Temporal workflow, runs Gemini calls, applies static + runtime validation, and stops before any Supabase or Temporal integration steps.

Structured responses: Gemini is instructed to return JSON matching `{ "jsx": "...", "notes": "optional" }`, which we verify with Zod before compiling. This catches malformed output early and keeps the retry loop short.

## Temporal workflow flowchart

1. Input outline is refined with a system prompt.
2. Gemini generates JSX (or fixes previous JSX when errors are present).
3. TypeScript compile diagnostics and runtime validation are performed.
4. Valid JSX is pushed to Supabase Storage, the lesson row is marked complete, and a log row is inserted for each step.
5. Failures capture the diagnostic details and mark the lesson as failed.

These steps are implemented in `lib/generation/runner.ts` and reused everywhere to avoid divergence between local harness runs and live workflows.

## Observability

- Lesson detail page (`app/lessons/[id]/page.tsx`) surfaces log history and the raw JSX payload.
- `lesson_generation_logs` captures `step`, `attempt`, status, and structured info (e.g., TypeScript error codes) for each run.

## Testing end-to-end

1. Run `bun run dev` and `bun run worker`.
2. Submit a lesson outline from the UI.
3. Watch the status move through `queued → running → completed/failed`.
4. Inspect Supabase tables (`lessons`, `lesson_generation_logs`) or fetch API responses from `/api/lessons/[id]`.

## Contributing

1. Fork / branch from `main`.
2. Ensure `bun run lint` and `bun run build` pass.
3. Include relevant migrations, harness fixtures, or tests for behavioral changes.
4. Open a PR with context on Gemini prompt changes and expected outputs.

---

Have feedback or ideas? File an issue or open a PR so we can make lesson generation even smoother.

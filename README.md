<h1 align="center">Astral Lesson Generator</h1>

<p align="center">
Minimal Next.js app that stores lesson outlines in Supabase and triggers Temporal workflows.
</p>

## Overview

This project replaces the original Supabase starter kit with a focused workflow:

- Accept lesson outlines from a simple UI (`app/page.tsx`).
- Persist each outline to a Supabase `lessons` table.
- Kick off a Temporal workflow that turns the outline into a fully generated lesson.

The backend work is handled via Next.js Route Handlers, Supabase server clients, and the Temporal JavaScript SDK.

## Tech Stack

- [Next.js 15 App Router](https://nextjs.org/docs/app)
- [Bun](https://bun.sh/) for package management and scripts
- [Supabase](https://supabase.com/) for persistence
- [Temporal](https://temporal.io/) for background workflow execution
- [Tailwind CSS](https://tailwindcss.com/) for styling

## Prerequisites

- Node.js ≥ 18 (Bun bundles one, but Temporal tooling expects modern runtimes)
- [Bun](https://bun.sh/docs/installation)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for migrations)
- Access to a Temporal Cloud/Dev server and API credentials

## Getting Started

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy `.env.example` to `.env.local` and populate the required Supabase and Temporal values (see [Environment](#environment)).

3. Run database migrations locally or against your remote project (see [Database migrations](#database-migrations)).

4. Start the dev server:

   ```bash
   bun run dev
   ```

   The app is available at [http://localhost:3000](http://localhost:3000).

## Environment

Environment variables are documented in `.env.example`. At a minimum you'll need:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (used by server code for inserts)
- Temporal connection details (namespace, address, API key)

Update `.env.local` locally and configure the same values wherever you deploy.

## Database migrations

Migrations live in `supabase/migrations`. The project currently defines a `lessons` table with automatic `updated_at` tracking.

### Creating a migration

```bash
supabase migration new <name>
```

This creates a timestamped SQL file under `supabase/migrations`. Write raw SQL that reflects the desired schema changes.

### Applying migrations

```bash
supabase db push
```

`db push` will apply any pending migrations to the connected Supabase project. If you're targeting a local Supabase stack, ensure it's running before executing the command.

### Checking status

```bash
supabase status
```

This command reports which migrations have been applied and which are pending.

> **Tip:** Commit each new migration alongside the changes that depend on it so deployments stay in sync.

## Scripts

Common scripts defined in `package.json`:

- `bun run dev` – Start the Next.js dev server
- `bun run build` – Build the production bundle
- `bun run lint` – Run ESLint checks

## Testing the Integration

- Submit an outline from the homepage form.
- Inspect the `lessons` table in Supabase to confirm the insert.
- Validate that the Temporal workflow was scheduled (via Temporal UI or CLI).

## Project Roadmap

- [x] Supabase `lessons` table migration
- [ ] API route to create a lesson and trigger Temporal
- [ ] UI wiring to call the API and reflect workflow status

Contributions and PRs are welcome once the foundational workflow is complete.

-- Enable pgcrypto for gen_random_uuid if not already enabled
create extension if not exists "pgcrypto";

create table if not exists public.lessons (
	id uuid primary key default gen_random_uuid(),
	outline text not null,
	status text not null default 'queued',
	temporal_workflow_id text,
	temporal_run_id text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists lessons_status_idx on public.lessons (status);

create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
	new.updated_at = now();
	return new;
end;
$$ language plpgsql;

drop trigger if exists handle_updated_at on public.lessons;
create trigger handle_updated_at
before update on public.lessons
for each row
execute procedure public.set_current_timestamp_updated_at();

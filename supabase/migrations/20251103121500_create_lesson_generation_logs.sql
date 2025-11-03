create table if not exists public.lesson_generation_logs (
  id bigserial primary key,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  workflow_id text not null,
  workflow_run_id text not null,
  step text not null,
  attempt integer not null default 0,
  status text not null check (status in ('success', 'failure')),
  info jsonb,
  event_timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists lesson_generation_logs_lesson_id_idx
  on public.lesson_generation_logs (lesson_id);

create index if not exists lesson_generation_logs_created_at_idx
  on public.lesson_generation_logs (created_at);

create index if not exists lesson_generation_logs_lesson_event_idx
  on public.lesson_generation_logs (lesson_id, event_timestamp);

create index if not exists lesson_generation_logs_workflow_run_idx
  on public.lesson_generation_logs (workflow_run_id);

-- Add columns to store both JSX source and compiled code
-- This allows us to remove Babel from the frontend and pre-compile JSX on the backend

alter table public.lessons
  add column if not exists jsx_source text,
  add column if not exists compiled_code text;

-- Create indexes for efficient queries if needed
create index if not exists lessons_compiled_code_idx on public.lessons (id) 
  where compiled_code is not null;

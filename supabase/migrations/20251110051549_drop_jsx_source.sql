-- Drop jsx_source column - JSX is already stored in storage via jsx_storage_path
-- This keeps DB purely for metadata/paths

alter table public.lessons
  drop column if exists jsx_source;

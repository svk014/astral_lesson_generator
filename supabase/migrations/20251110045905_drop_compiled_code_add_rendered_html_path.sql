-- Drop unnecessary text columns and move everything to storage
-- Keep only paths in DB, fetch content from storage when needed

alter table public.lessons
  drop column if exists compiled_code,
  drop column if exists rendered_html,
  add column if not exists rendered_html_path text;

-- Create index for efficient queries on rendered_html_path
create index if not exists lessons_rendered_html_path_idx on public.lessons (id) 
  where rendered_html_path is not null;

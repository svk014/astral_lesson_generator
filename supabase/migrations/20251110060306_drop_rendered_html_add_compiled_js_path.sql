-- Switch from SSR HTML to client-side ES modules
-- Drop rendered_html_path, add compiled_js_path for ES module location

alter table public.lessons
  drop column if exists rendered_html_path,
  add column if not exists compiled_js_path text;

-- Create index for efficient queries
create index if not exists lessons_compiled_js_path_idx on public.lessons (id) 
  where compiled_js_path is not null;

alter table public.lessons
  add column if not exists jsx_storage_path text,
  add column if not exists jsx_public_url text,
  add column if not exists error_message text;

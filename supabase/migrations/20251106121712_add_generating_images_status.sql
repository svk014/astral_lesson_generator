-- Add 'generating_images' status to the lessons table status constraint
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_status_check;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_status_check
  CHECK (status IN (
    'pending', 'queued', 'running', 'generating_images', 'generating_jsx', 'validating_jsx', 'storing_jsx', 'completed', 'failed', 'cancelled', 'timeout'
  ));

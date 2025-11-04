-- Update lesson status to use granular workflow states
-- 1. Change default to 'pending'
-- 2. Add constraint for allowed values
-- 3. Optionally migrate existing values

-- Change default to 'pending'
ALTER TABLE public.lessons ALTER COLUMN status SET DEFAULT 'pending';

-- Add constraint for allowed status values
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_status_check;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_status_check
  CHECK (status IN (
    'pending', 'queued', 'running', 'generating_jsx', 'validating_jsx', 'storing_jsx', 'completed', 'failed', 'cancelled', 'timeout'
  ));

-- Optionally migrate existing lessons to new status values
UPDATE public.lessons SET status = 'pending' WHERE status = 'queued';
-- You can add more UPDATE statements if you want to remap other old values

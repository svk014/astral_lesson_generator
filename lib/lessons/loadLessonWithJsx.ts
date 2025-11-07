import { getServiceSupabaseClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

type LessonRecord = {
  id: string;
  outline: string;
  status: string;
  jsx_storage_path: string | null;
  jsx_public_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

export type LessonWithJsx = {
  lesson: LessonRecord;
  jsx: string | null;
};

async function downloadJsxFromStorage(
  lesson: LessonRecord,
  supabase = getServiceSupabaseClient(),
): Promise<string | null> {
  if (!lesson.jsx_storage_path) {
    return null;
  }

  const { data: file, error } = await supabase.storage
    .from(env.supabase.storageBucket)
    .download(lesson.jsx_storage_path);

  if (error) {
    console.error('Failed to download generated JSX', error);
    return null;
  }

  if (!file) {
    return null;
  }

  try {
    return await file.text();
  } catch (err) {
    console.error('Failed to read JSX blob as text', err);
    return null;
  }
}

async function fetchJsxFromPublicUrl(lesson: LessonRecord): Promise<string | null> {
  if (!lesson.jsx_public_url) {
    return null;
  }

  try {
    const response = await fetch(lesson.jsx_public_url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('Public URL fetch failed', lesson.jsx_public_url, response.status);
      return null;
    }

    return await response.text();
  } catch (err) {
    console.error('Failed to fetch JSX from public URL', err);
    return null;
  }
}

export async function loadLessonWithJsx(lessonId: string): Promise<LessonWithJsx | null> {
  const supabase = getServiceSupabaseClient();

  const { data: lessonData, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch lesson', error);
    throw new Error('Failed to fetch lesson');
  }

  if (!lessonData) {
    return null;
  }

  const lesson = lessonData as LessonRecord;

  let jsx = await downloadJsxFromStorage(lesson, supabase);

  if (!jsx) {
    jsx = await fetchJsxFromPublicUrl(lesson);
  }

  return {
    lesson,
    jsx,
  };
}

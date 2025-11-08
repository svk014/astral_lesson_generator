import { getServiceSupabaseClient } from '@/lib/supabase/server';

type LessonRecord = {
  id: string;
  outline: string;
  status: string;
  jsx_storage_path: string | null;
  jsx_public_url: string | null;
  jsx_source: string | null;
  compiled_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

export type LessonWithJsx = {
  lesson: LessonRecord;
  compiledCode: string | null;
};

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

  // Try to use compiled_code from the database first
  let compiledCode = lesson.compiled_code;

  // Fallback to jsx_source if available (for backward compatibility)
  if (!compiledCode && lesson.jsx_source) {
    compiledCode = lesson.jsx_source;
  }

  return {
    lesson,
    compiledCode,
  };
}

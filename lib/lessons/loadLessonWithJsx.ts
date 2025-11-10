import { getServiceSupabaseClient } from '@/lib/supabase/server';

type LessonRecord = {
  id: string;
  outline: string;
  status: string;
  jsx_storage_path: string | null;
  jsx_public_url: string | null;
  compiled_js_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

export type LessonWithJsx = {
  lesson: LessonRecord;
  compiledJsPath: string | null;
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

  return {
    lesson,
    compiledJsPath: lesson.compiled_js_path,
  };
}

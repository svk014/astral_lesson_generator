import { getServiceSupabaseClient } from '@/lib/supabase/server';

type LessonRecord = {
  id: string;
  outline: string;
  status: string;
  jsx_storage_path: string | null;
  jsx_public_url: string | null;
  jsx_source: string | null;
  compiled_code: string | null;
  rendered_html: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

export type LessonWithJsx = {
  lesson: LessonRecord;
  renderedHtml: string | null;
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

  // Use rendered_html from the database for server-side rendering
  const renderedHtml = lesson.rendered_html;

  return {
    lesson,
    renderedHtml,
  };
}

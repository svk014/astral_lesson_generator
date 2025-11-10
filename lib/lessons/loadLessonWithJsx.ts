import { getServiceSupabaseClient } from '@/lib/supabase/server';

type LessonRecord = {
  id: string;
  outline: string;
  status: string;
  jsx_storage_path: string | null;
  jsx_public_url: string | null;
  rendered_html_path: string | null;
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

  // Fetch rendered HTML from storage if path exists
  let renderedHtml: string | null = null;
  if (lesson.rendered_html_path) {
    try {
      const { data, error: downloadError } = await supabase.storage
        .from('lessons')
        .download(lesson.rendered_html_path);

      if (downloadError) {
        console.error('Failed to fetch rendered HTML from storage', downloadError);
      } else if (data) {
        renderedHtml = await data.text();
      }
    } catch (err) {
      console.error('Error reading rendered HTML from storage:', err);
    }
  }

  return {
    lesson,
    renderedHtml,
  };
}

import { NextRequest, NextResponse } from 'next/server';

import { getServiceSupabaseClient } from '@/lib/supabase/server';

const storageBucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'lessons';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: lessonId } = await context.params;
  const supabase = getServiceSupabaseClient();

  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch lesson', error);
    return NextResponse.json({ error: 'Failed to fetch lesson' }, { status: 500 });
  }

  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  let jsx: string | null = null;

  const { data: logs, error: logsError } = await supabase
    .from('lesson_generation_logs')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('event_timestamp', { ascending: true });

  if (logsError) {
    console.error('Failed to load lesson generation logs', logsError);
  }

  if (lesson.jsx_storage_path) {
    const { data: file, error: downloadError } = await supabase.storage
      .from(storageBucket)
      .download(lesson.jsx_storage_path);

    if (downloadError) {
      console.error('Failed to download generated JSX', downloadError);
    } else if (file) {
      // In Node, download returns a Blob
      jsx = await file.text();
    }
  }

  return NextResponse.json({ lesson, jsx, logs: logs ?? [] });
}

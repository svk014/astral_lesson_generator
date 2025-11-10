import { NextResponse } from 'next/server';

import { getServiceSupabaseClient } from '@/lib/supabase/server';
import { getTemporalClient } from '@/lib/temporal/client';
import { env } from '@/lib/env';
import { LessonStatus } from '@/lib/temporal/types';

type LessonRow = {
  id: string;
  outline: string;
  status: string;
  temporal_workflow_id: string | null;
  temporal_run_id: string | null;
  jsx_public_url: string | null;
  jsx_storage_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const supabase = getServiceSupabaseClient();

  // Fetch lessons with pagination
  const { data: lessons, error } = await supabase
    .from('lessons')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Get total count
  const { count } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 });
  }

  return NextResponse.json({ lessons, total: count ?? 0 });
}
// POST handler follows
export async function POST(request: Request) {
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Expected application/json body' }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error('Failed to parse request body', error);
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const outline = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>).outline : undefined;

  if (typeof outline !== 'string' || outline.trim().length === 0) {
    return NextResponse.json({ error: 'outline is required' }, { status: 400 });
  }

  const normalizedOutline = outline.trim();

  const supabase = getServiceSupabaseClient();
  const taskQueue = env.temporal.taskQueue;
  const workflowType = env.temporal.workflowType;

  let lesson: LessonRow | null = null;

  try {
    const { data: createdLesson, error: insertError } = await supabase
      .from('lessons')
      .insert({ outline: normalizedOutline, status: LessonStatus.PENDING })
      .select()
      .single<LessonRow>();

    if (insertError) {
      console.error('Supabase insert failed', insertError);
      return NextResponse.json({ error: 'Failed to persist lesson' }, { status: 500 });
    }

    lesson = createdLesson;

    const temporalClient = await getTemporalClient();

    const handle = await temporalClient.start(workflowType, {
      args: [
        {
          lessonId: lesson.id,
          outline: lesson.outline,
        },
      ],
      taskQueue,
      workflowId: lesson.id,
    });

    const { data: updatedLesson, error: updateError } = await supabase
      .from('lessons')
      .update({
        status: LessonStatus.QUEUED,
        temporal_workflow_id: handle.workflowId,
        temporal_run_id: handle.firstExecutionRunId,
      })
      .eq('id', lesson.id)
      .select()
      .single<LessonRow>();

    if (updateError || !updatedLesson) {
      console.error('Supabase update failed', updateError);
      return NextResponse.json({ error: 'Failed to update lesson status' }, { status: 500 });
    }

    return NextResponse.json({ lesson: updatedLesson }, { status: 201 });
  } catch (error) {
    console.error('Lesson creation failed', error);

    if (lesson) {
      await supabase
        .from('lessons')
        .update({ status: LessonStatus.FAILED, error_message: 'Failed before workflow start' })
        .eq('id', lesson.id);
    }

    return NextResponse.json({ error: 'Failed to create lesson' }, { status: 500 });
  }
}

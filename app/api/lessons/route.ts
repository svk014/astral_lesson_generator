import { NextResponse } from 'next/server';

import { getServiceSupabaseClient } from '@/lib/supabase/server';
import { getTemporalClient } from '@/lib/temporal/client';

type LessonRow = {
  id: string;
  outline: string;
  status: string;
  temporal_workflow_id: string | null;
  temporal_run_id: string | null;
  created_at: string;
  updated_at: string;
};

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

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
  const taskQueue = requireEnv('TEMPORAL_TASK_QUEUE', process.env.TEMPORAL_TASK_QUEUE);
  const workflowType = requireEnv('TEMPORAL_WORKFLOW_TYPE', process.env.TEMPORAL_WORKFLOW_TYPE);

  let lesson: LessonRow | null = null;

  try {
    const { data: createdLesson, error: insertError } = await supabase
      .from('lessons')
      .insert({ outline: normalizedOutline })
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
        status: 'running',
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
        .update({ status: 'error' })
        .eq('id', lesson.id);
    }

    return NextResponse.json({ error: 'Failed to create lesson' }, { status: 500 });
  }
}

import { createClient } from '@supabase/supabase-js';
import { env } from '../../env';
import type { LessonCompletedPayload, LessonGenerationLogPayload } from '../types';
import { LessonStatus } from '../types';

const supabase = createClient(env.supabase.url, env.supabase.serviceKey);

/** Helper to batch status updates with consistent error handling */
async function updateLessonStatus(
  lessonId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('lessons')
    .update(updates)
    .eq('id', lessonId);

  if (error) {
    throw new Error(`Failed to update lesson: ${error.message}`);
  }
}

/** Mark lesson as completed with all generated artifacts */
export async function markLessonCompleted(
  lessonId: string,
  payload?: LessonCompletedPayload,
) {
  const { error } = await supabase
    .from('lessons')
    .update({
      status: LessonStatus.COMPLETED,
      jsx_public_url: payload?.jsxPublicUrl ?? null,
      jsx_storage_path: payload?.jsxStoragePath ?? null,
      jsx_source: payload?.jsxSource ?? null,
      compiled_code: payload?.compiledCode ?? null,
      rendered_html: payload?.renderedHtml ?? null,
      error_message: null,
    })
    .eq('id', lessonId);

  if (error) {
    throw new Error(`Failed to update lesson: ${error.message}`);
  }
}

/** Mark lesson as failed with error message */
export async function markLessonFailed(lessonId: string, failureReason: string) {
  return updateLessonStatus(lessonId, { status: LessonStatus.FAILED, error_message: failureReason });
}

/** Mark lesson as queued */
export async function markLessonQueued(lessonId: string) {
  return updateLessonStatus(lessonId, { status: LessonStatus.QUEUED });
}

/** Mark lesson as running */
export async function markLessonRunning(lessonId: string) {
  return updateLessonStatus(lessonId, { status: LessonStatus.RUNNING });
}

/** Update lesson status for workflow steps */
export async function markLessonStep(lessonId: string, step: string) {
  return updateLessonStatus(lessonId, { status: step });
}

/** Record generation log entry */
export async function insertLessonGenerationLog(payload: LessonGenerationLogPayload) {
  const { error } = await supabase.from('lesson_generation_logs').insert({
    lesson_id: payload.lessonId,
    workflow_id: payload.workflowId,
    workflow_run_id: payload.workflowRunId,
    step: payload.step,
    attempt: payload.attempt,
    status: payload.status,
    info: payload.info ?? null,
    event_timestamp: payload.eventTimestamp,
  });

  if (error) {
    console.error('Failed to insert lesson generation log', {
      lessonId: payload.lessonId,
      step: payload.step,
      attempt: payload.attempt,
      error: error.message,
    });
  }
}

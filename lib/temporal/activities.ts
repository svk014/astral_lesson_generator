import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import {
  refinePromptWithSystemMessage,
  generateJSXWithGemini as generateJSXService,
  validateJSXStatic,
  validateJSXRuntime,
  fixIssuesWithGemini,
} from '../generation/services';
import {
  generateAndStoreImages,
} from '../generation/imageGeneration';

export {
  refinePromptWithSystemMessage,
  validateJSXStatic,
  validateJSXRuntime,
  fixIssuesWithGemini,
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.NEXT_PRIVATE_SUPABASE_SECRET_KEY;
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'lessons';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PRIVATE_SUPABASE_SECRET_KEY are required');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

/**
 * Activity wrapper for JSX generation that accepts images
 */
export async function generateJSXWithGemini(
  prompt: string,
  images?: Array<{ id: string; title: string; shortUrl: string; description: string }>,
): Promise<string> {
  return generateJSXService(prompt, images);
}

export async function getLessonById(lessonId: string) {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch lesson: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Lesson ${lessonId} not found`);
  }

  return data;
}


export async function markLessonCompleted(
  lessonId: string,
  payload?: { jsxPublicUrl: string; jsxStoragePath: string },
) {
  const { error } = await supabase
    .from('lessons')
    .update({
      status: 'completed',
      jsx_public_url: payload?.jsxPublicUrl ?? null,
      jsx_storage_path: payload?.jsxStoragePath ?? null,
      error_message: null,
    })
    .eq('id', lessonId);

  if (error) {
    throw new Error(`Failed to update lesson: ${error.message}`);
  }
}

export async function markLessonQueued(lessonId: string) {
  const { error } = await supabase
    .from('lessons')
    .update({ status: 'queued' })
    .eq('id', lessonId);
  if (error) {
    throw new Error(`Failed to mark lesson queued: ${error.message}`);
  }
}

export async function markLessonRunning(lessonId: string) {
  const { error } = await supabase
    .from('lessons')
    .update({ status: 'running' })
    .eq('id', lessonId);
  if (error) {
    throw new Error(`Failed to mark lesson running: ${error.message}`);
  }
}

export async function markLessonStep(lessonId: string, step: string) {
  const { error } = await supabase
    .from('lessons')
    .update({ status: step })
    .eq('id', lessonId);
  if (error) {
    throw new Error(`Failed to mark lesson step: ${error.message}`);
  }
}

export async function markLessonFailed(lessonId: string, failureReason: string) {
  const { error } = await supabase
    .from('lessons')
    .update({ status: 'failed', error_message: failureReason })
    .eq('id', lessonId);

  if (error) {
    throw new Error(`Failed to mark lesson failed: ${error.message}`);
  }
}

type LessonGenerationLogPayload = {
  lessonId: string;
  workflowId: string;
  workflowRunId: string;
  step: string;
  attempt: number;
  status: 'success' | 'failure';
  info?: unknown;
  eventTimestamp: string;
};

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

export async function storeJSXInSupabase(
  lessonId: string,
  jsx: string,
): Promise<{ publicUrl: string; storagePath: string }> {
  const filePath = `${lessonId}/${randomUUID()}.jsx`;
  const buffer = Buffer.from(jsx, 'utf-8');

  const { error: uploadError } = await supabase.storage
    .from(storageBucket)
    .upload(filePath, buffer, { upsert: true, contentType: 'text/jsx' });

  if (uploadError) {
    throw new Error(`Failed to upload JSX: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(storageBucket)
    .getPublicUrl(filePath);

  if (!publicUrlData.publicUrl) {
    throw new Error('Failed to obtain public URL for JSX');
  }

  return { publicUrl: publicUrlData.publicUrl, storagePath: filePath };
}

export async function generateImagesActivity(
  outline: string,
  refinedPrompt: string,
  lessonId: string,
) {
  const supabaseClient = createClient(supabaseUrl!, serviceRoleKey!);
  return generateAndStoreImages(outline, refinedPrompt, lessonId, supabaseClient);
}
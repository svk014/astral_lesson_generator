import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../env';

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
import { compileJsxToJs } from '../generation/jsxCompiler';
import { executeComponentCode } from '../generation/componentExecutor';

export {
  refinePromptWithSystemMessage,
  validateJSXStatic,
  validateJSXRuntime,
  fixIssuesWithGemini,
};

const supabase = createClient(env.supabase.url, env.supabase.serviceKey);

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
  payload?: { 
    jsxPublicUrl: string; 
    jsxStoragePath: string; 
    jsxSource?: string; 
    compiledCode?: string;
    renderedHtml?: string;
  },
) {
  const { error } = await supabase
    .from('lessons')
    .update({
      status: 'completed',
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
    .from(env.supabase.storageBucket)
    .upload(filePath, buffer, { upsert: true, contentType: 'text/jsx' });

  if (uploadError) {
    throw new Error(`Failed to upload JSX: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(env.supabase.storageBucket)
    .getPublicUrl(filePath);

  if (!publicUrlData.publicUrl) {
    throw new Error('Failed to obtain public URL for JSX');
  }

  return { publicUrl: publicUrlData.publicUrl, storagePath: filePath };
}

/**
 * Compiles JSX source code to JavaScript and stores both versions
 */
export async function compileAndStoreJSX(
  lessonId: string,
  jsxSource: string,
): Promise<{ jsxSource: string; compiledCode: string }> {
  try {
    const compiledCode = compileJsxToJs(jsxSource);
    return { jsxSource, compiledCode };
  } catch (error) {
    throw new Error(
      `Failed to compile JSX: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Renders compiled JSX code to static HTML using server-side rendering
 */
export async function renderJSXToHtml(compiledCode: string): Promise<string> {
  try {
    const result = executeComponentCode(compiledCode);
    
    if (!result.success) {
      throw new Error(`Component execution failed: ${result.error}`);
    }

    // Dynamically import react-dom/server to avoid server-only module issues
    const reactDomServer = await import('react-dom/server');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react') as typeof import('react');

    // Render the component to static HTML
    const renderedHtml = reactDomServer.renderToStaticMarkup(
      React.createElement(result.component as React.ComponentType),
    );
    
    return renderedHtml;
  } catch (error) {
    throw new Error(
      `Failed to render JSX to HTML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function generateImagesActivity(
  outline: string,
  refinedPrompt: string,
  lessonId: string,
) {
  const supabaseClient = createClient(env.supabase.url, env.supabase.serviceKey);
  return generateAndStoreImages(outline, refinedPrompt, lessonId, supabaseClient);
}
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../../env';
import { compileJsxToJs } from '../../generation/jsxCompiler';

const supabase = createClient(env.supabase.url, env.supabase.serviceKey);

/** Fetch lesson by ID */
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

/** Upload JSX source to Supabase storage and get public URL */
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

/** Compile JSX to ES module and save to storage */
export async function compileAndStoreJSX(
  lessonId: string,
  jsxSource: string,
): Promise<{ storagePath: string }> {
  try {
    const compiledCode = compileJsxToJs(jsxSource);
    
    // Save compiled JS as ES module to storage
    const filePath = `${lessonId}/${randomUUID()}.js`;
    const buffer = Buffer.from(compiledCode, 'utf-8');

    const { error: uploadError } = await supabase.storage
      .from(env.supabase.storageBucket)
      .upload(filePath, buffer, { upsert: true, contentType: 'application/javascript' });

    if (uploadError) {
      throw new Error(`Failed to upload compiled JS: ${uploadError.message}`);
    }

    return { storagePath: filePath };
  } catch (error) {
    throw new Error(
      `Failed to compile and store JSX: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}


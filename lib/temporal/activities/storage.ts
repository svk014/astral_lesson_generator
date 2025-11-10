import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../../env';
import { compileJsxToJs } from '../../generation/jsxCompiler';
import { executeComponentCode } from '../../generation/componentExecutor';

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

/** Compile JSX to JavaScript */
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

/** Render compiled JSX to static HTML and save to storage */
export async function renderJSXToHtml(
  lessonId: string,
  compiledCode: string,
): Promise<{ html: string; storagePath: string }> {
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

    // Save rendered HTML to storage
    const filePath = `${lessonId}/${randomUUID()}.html`;
    const buffer = Buffer.from(renderedHtml, 'utf-8');

    const { error: uploadError } = await supabase.storage
      .from(env.supabase.storageBucket)
      .upload(filePath, buffer, { upsert: true, contentType: 'text/html' });

    if (uploadError) {
      throw new Error(`Failed to upload rendered HTML: ${uploadError.message}`);
    }

    return { html: renderedHtml, storagePath: filePath };
  } catch (error) {
    throw new Error(
      `Failed to render JSX to HTML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

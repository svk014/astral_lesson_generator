import { storeJSXInSupabase } from './storage';
import { compileAndStoreJSX } from './storage';
import { renderJSXToHtml } from './storage';
import { markLessonCompleted } from './status';

/** Atomically stores JSX, compiles, renders to HTML, and updates database */
export async function saveCompleteLesson(
  lessonId: string,
  jsx: string,
): Promise<{ publicUrl: string; storagePath: string }> {
  const storage = await storeJSXInSupabase(lessonId, jsx);
  const compiled = await compileAndStoreJSX(lessonId, jsx);
  const rendered = await renderJSXToHtml(lessonId, compiled.compiledCode);

  await markLessonCompleted(lessonId, {
    jsxPublicUrl: storage.publicUrl,
    jsxStoragePath: storage.storagePath,
    renderedHtmlPath: rendered.storagePath,
  });

  return storage;
}

import { storeJSXInSupabase } from './storage';
import { compileAndStoreJSX } from './storage';
import { markLessonCompleted } from './status';

/** Atomically stores JSX, compiles to ES module, and updates database */
export async function saveCompleteLesson(
  lessonId: string,
  jsx: string,
): Promise<{ publicUrl: string; storagePath: string }> {
  const storage = await storeJSXInSupabase(lessonId, jsx);
  const compiled = await compileAndStoreJSX(lessonId, jsx);

  await markLessonCompleted(lessonId, {
    jsxPublicUrl: storage.publicUrl,
    jsxStoragePath: storage.storagePath,
    compiledJsPath: compiled.publicUrl,
  });

  return storage;
}

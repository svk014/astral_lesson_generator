// Text Generation Activities
export {
  refinePromptWithSystemMessage,
  generateJSXWithGemini,
  generateImagesActivity,
  fixIssuesWithGemini,
} from './textGeneration';

// Validation Activities
export { validateJSXStatic, validateJSXRuntime } from './validation';

// Storage Activities
export { getLessonById, storeJSXInSupabase, compileAndStoreJSX, renderJSXToHtml } from './storage';

// Status Activities
export {
  markLessonCompleted,
  markLessonFailed,
  markLessonQueued,
  markLessonRunning,
  markLessonStep,
  insertLessonGenerationLog,
} from './status';

// Composite Activities (coordination of multiple concerns)
export { saveCompleteLesson } from './completion';

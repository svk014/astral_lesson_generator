import type { ValidationResult, RuntimeValidationResult } from '../generation/schemas';

export enum LessonStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  GENERATING_JSX = 'generating_jsx',
  VALIDATING_JSX = 'validating_jsx',
  GENERATING_IMAGES = 'generating_images',
  STORING_JSX = 'storing_jsx',
  RENDERING_HTML = 'rendering_html',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export type LessonCompletedPayload = {
  jsxPublicUrl: string;
  jsxStoragePath: string;
  compiledJsPath?: string;
};

export type LessonGenerationLogPayload = {
  lessonId: string;
  workflowId: string;
  workflowRunId: string;
  step: string;
  attempt: number;
  status: 'success' | 'failure';
  info?: unknown;
  eventTimestamp: string;
};

export type TextGenerationActivities = {
  refinePromptWithSystemMessage(outline: string): Promise<string>;
  generateImagesActivity(
    outline: string,
    refinedPrompt: string,
    lessonId: string,
  ): Promise<Array<{ id: string; title: string; shortUrl: string; description: string }>>;
  generateJSXWithGemini(
    prompt: string,
    images?: Array<{ id: string; title: string; shortUrl: string; description: string }>,
  ): Promise<string>;
  fixIssuesWithGemini(jsx: string, errors: string[]): Promise<string>;
};

export type ValidationActivities = {
  validateJSXStatic(jsx: string): Promise<ValidationResult>;
  validateJSXRuntime(jsx: string): Promise<RuntimeValidationResult>;
};

export type StorageActivities = {
  getLessonById(lessonId: string): Promise<Record<string, unknown>>;
  storeJSXInSupabase(
    lessonId: string,
    jsx: string,
  ): Promise<{ publicUrl: string; storagePath: string }>;
  compileAndStoreJSX(
    lessonId: string,
    jsxSource: string,
  ): Promise<{ storagePath: string }>;
  saveCompleteLesson(
    lessonId: string,
    jsx: string,
  ): Promise<{ publicUrl: string; storagePath: string }>;
};

export type StatusActivities = {
  markLessonCompleted(lessonId: string, payload?: LessonCompletedPayload): Promise<void>;
  markLessonFailed(lessonId: string, failureReason: string): Promise<void>;
  markLessonQueued(lessonId: string): Promise<void>;
  markLessonRunning(lessonId: string): Promise<void>;
  markLessonStep(lessonId: string, step: string): Promise<void>;
  insertLessonGenerationLog(payload: LessonGenerationLogPayload): Promise<void>;
};

export type LessonActivities = TextGenerationActivities & ValidationActivities & StorageActivities & StatusActivities;

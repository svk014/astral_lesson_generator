import type { ValidationResult } from './services';

export type GenerationLogEntry = {
  step: string;
  attempt: number;
  status: 'success' | 'failure';
  info?: unknown;
  timestamp: string;
};

export type GenerationDeps = {
  refinePrompt: (outline: string) => Promise<string>;
  generateImages?: (
    outline: string,
    refinedPrompt: string,
    lessonId?: string,
    recordLog?: (entry: Omit<GenerationLogEntry, 'timestamp'>) => Promise<void> | void
  ) => Promise<Array<{ id: string; title: string; shortUrl: string; description: string }>>;
  generateJSX: (
    prompt: string,
    images?: Array<{ id: string; title: string; shortUrl: string; description: string }>
  ) => Promise<string>;
  validateJSXStatic: (jsx: string) => Promise<ValidationResult>;
  validateJSXRuntime?: (jsx: string) => Promise<ValidationResult>;
  fixIssues: (jsx: string, errors: string[]) => Promise<string>;
  storeJSX?: (args: { lessonId?: string; jsx: string }) => Promise<Record<string, unknown> | void>;
};

export type GenerationHooks = {
  recordLog?: (entry: GenerationLogEntry) => Promise<void> | void;
  onSuccess?: (payload: {
    lessonId?: string;
    attempt: number;
    storage?: Record<string, unknown> | void;
    jsx: string;
  }) => Promise<void> | void;
  onFailure?: (payload: {
    lessonId?: string;
    attempt: number;
    error: string;
    lastJsx?: string;
  }) => Promise<void> | void;
  flush?: () => Promise<void> | void;
};

export type RunLessonGenerationArgs = {
  outline: string;
  lessonId?: string;
};

export type LessonGenerationSuccess = {
  status: 'completed';
  lessonId?: string;
  outline: string;
  attempt: number;
  jsx: string;
  storage?: Record<string, unknown> | void;
  logs: GenerationLogEntry[];
};

export type LessonGenerationFailure = {
  status: 'failed';
  lessonId?: string;
  outline: string;
  attempt: number;
  error: string;
  lastJsx?: string;
  logs: GenerationLogEntry[];
};

export type LessonGenerationOutcome = LessonGenerationSuccess | LessonGenerationFailure;

export async function runLessonGeneration(
  args: RunLessonGenerationArgs,
  deps: GenerationDeps,
  options: { maxAttempts?: number; hooks?: GenerationHooks } = {},
): Promise<LessonGenerationOutcome> {
  const { outline, lessonId } = args;
  const { maxAttempts = 3, hooks = {} } = options;
  const logs: GenerationLogEntry[] = [];

  const record = async (entry: Omit<GenerationLogEntry, 'timestamp'>) => {
    const timestamp = new Date().toISOString();
    const logEntry: GenerationLogEntry = { ...entry, timestamp };
    logs.push(logEntry);
    await hooks.recordLog?.(logEntry);
  };

  const refinedPrompt = await deps.refinePrompt(outline);
  await record({ step: 'refinePrompt', attempt: 0, status: 'success', info: { outline } });

  // Optionally generate images if hook provided
  let images: Array<{ id: string; title: string; shortUrl: string; description: string }> = [];
  if (deps.generateImages) {
    try {
      images = await deps.generateImages(outline, refinedPrompt, lessonId, record);
      await record({
        step: 'generateImages',
        attempt: 0,
        status: 'success',
        info: { count: images.length, images },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image generation failed';
      console.warn(`[Runner] Image generation failed, continuing without images: ${message}`);
      await record({ step: 'generateImages', attempt: 0, status: 'failure', info: { message } });
      images = [];
    }
  }

  let attempt = 0;
  let currentJsx = '';
  let lastErrors: string[] = [];

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      if (attempt === 1 || lastErrors.length === 0) {
        currentJsx = await deps.generateJSX(refinedPrompt, images.length > 0 ? images : undefined);
        await record({ step: 'generateJSX', attempt, status: 'success' });
      } else {
        currentJsx = await deps.fixIssues(currentJsx, lastErrors);
        await record({ step: 'fixJSX', attempt, status: 'success', info: { errors: lastErrors } });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed';
      await record({ step: 'generateJSX', attempt, status: 'failure', info: { message } });
      lastErrors = [message];
      continue;
    }

    const staticResult = await deps.validateJSXStatic(currentJsx);
    await record({
      step: 'validateStatic',
      attempt,
      status: staticResult.valid ? 'success' : 'failure',
      info: staticResult,
    });

    if (!staticResult.valid) {
      lastErrors = staticResult.errors ?? ['Static validation failed'];
      continue;
    }

    const runtimeValidator = deps.validateJSXRuntime;
    if (runtimeValidator) {
      const runtimeResult = await runtimeValidator(currentJsx);
      await record({
        step: 'validateRuntime',
        attempt,
        status: runtimeResult.valid ? 'success' : 'failure',
        info: runtimeResult,
      });

      if (!runtimeResult.valid) {
        lastErrors = runtimeResult.errors ?? ['Runtime validation failed'];
        continue;
      }
    }

  let storageResult: Record<string, unknown> | void | undefined = undefined;
    if (deps.storeJSX) {
      storageResult = await deps.storeJSX({ lessonId, jsx: currentJsx });
      await record({ step: 'storeJSX', attempt, status: 'success', info: storageResult });
    }

    await hooks.onSuccess?.({ lessonId, attempt, storage: storageResult, jsx: currentJsx });
    await hooks.flush?.();

    return {
      status: 'completed',
      lessonId,
      outline,
      attempt,
      jsx: currentJsx,
      storage: storageResult,
      logs,
    };
  }

  const failureReason = lastErrors.join(' | ') || 'Lesson generation failed';
  await record({ step: 'workflowFailed', attempt, status: 'failure', info: { failureReason } });
  await hooks.onFailure?.({ lessonId, attempt, error: failureReason, lastJsx: currentJsx });
  await hooks.flush?.();

  return {
    status: 'failed',
    lessonId,
    outline,
    attempt,
    error: failureReason,
    lastJsx: currentJsx || undefined,
    logs,
  };
}

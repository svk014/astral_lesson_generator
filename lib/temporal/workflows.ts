import { proxyActivities, workflowInfo } from '@temporalio/workflow';

import { runLessonGeneration } from '../generation/runner';
import type { ValidationResult } from '../generation/types';

type LessonActivities = {
  getLessonById(lessonId: string): Promise<Record<string, unknown>>;
  markLessonCompleted(
    lessonId: string,
    payload?: { jsxPublicUrl: string; jsxStoragePath: string },
  ): Promise<void>;
  markLessonFailed(lessonId: string, failureReason: string): Promise<void>;
  markLessonQueued(lessonId: string): Promise<void>;
  markLessonRunning(lessonId: string): Promise<void>;
  markLessonStep(lessonId: string, step: string): Promise<void>;
  refinePromptWithSystemMessage(outline: string): Promise<string>;
  generateJSXWithGemini(prompt: string): Promise<string>;
  validateJSXStatic(jsx: string): Promise<ValidationResult>;
  validateJSXRuntime(jsx: string): Promise<ValidationResult>;
  fixIssuesWithGemini(jsx: string, errors: string[]): Promise<string>;
  storeJSXInSupabase(
    lessonId: string,
    jsx: string,
  ): Promise<{ publicUrl: string; storagePath: string }>;
  insertLessonGenerationLog(payload: {
    lessonId: string;
    workflowId: string;
    workflowRunId: string;
    step: string;
    attempt: number;
    status: 'success' | 'failure';
    info?: unknown;
    eventTimestamp: string;
  }): Promise<void>;
};

const activities = proxyActivities<LessonActivities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '2s',
    maximumAttempts: 3,
  },
});

export async function lessonGeneratorWorkflow(args: { lessonId: string; outline: string }) {
  const { lessonId, outline } = args;
  const { workflowId, runId } = workflowInfo();

  await activities.markLessonQueued(lessonId);
  await activities.getLessonById(lessonId);
  await activities.markLessonRunning(lessonId);

  const logTasks: Promise<void>[] = [];

  const outcome = await runLessonGeneration(
    { outline, lessonId },
    {
      refinePrompt: async (value) => {
        await activities.markLessonStep(lessonId, 'generating_jsx');
        return activities.refinePromptWithSystemMessage(value);
      },
      generateJSX: async (prompt) => {
        await activities.markLessonStep(lessonId, 'generating_jsx');
        return activities.generateJSXWithGemini(prompt);
      },
      validateJSXStatic: async (jsx) => {
        await activities.markLessonStep(lessonId, 'validating_jsx');
        return activities.validateJSXStatic(jsx);
      },
      validateJSXRuntime: async (jsx) => {
        await activities.markLessonStep(lessonId, 'validating_jsx');
        return activities.validateJSXRuntime(jsx);
      },
      fixIssues: async (jsx, errors) => {
        await activities.markLessonStep(lessonId, 'generating_jsx');
        return activities.fixIssuesWithGemini(jsx, errors);
      },
      storeJSX: async ({ lessonId: id, jsx }) => {
        if (!id) return undefined;
        await activities.markLessonStep(id, 'storing_jsx');
        const storage = await activities.storeJSXInSupabase(id, jsx);
        await activities.markLessonCompleted(id, {
          jsxPublicUrl: storage.publicUrl,
          jsxStoragePath: storage.storagePath,
        });
        return storage;
      },
    },
    {
      hooks: {
        recordLog: (log) => {
          logTasks.push(
            activities.insertLessonGenerationLog({
              lessonId,
              workflowId,
              workflowRunId: runId,
              step: log.step,
              attempt: log.attempt,
              status: log.status,
              info: log.info,
              eventTimestamp: log.timestamp,
            }),
          );
        },
        onFailure: async ({ error }) => {
          await activities.markLessonFailed(lessonId, error);
        },
        flush: async () => {
          await Promise.allSettled(logTasks);
        },
      },
    },
  );

  await Promise.allSettled(logTasks);

  if (outcome.status === 'completed') {
    return { lessonId, status: 'completed', jsxUrl: outcome.storage?.publicUrl ?? null };
  }

  return { lessonId, status: 'failed', error: outcome.error };
}
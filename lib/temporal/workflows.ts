import { proxyActivities, workflowInfo } from '@temporalio/workflow';

import { runLessonGeneration } from '../generation/runner';

type LessonActivities = {
  getLessonById(lessonId: string): Promise<Record<string, unknown>>;
  markLessonCompleted(
    lessonId: string,
    payload?: { jsxPublicUrl: string; jsxStoragePath: string },
  ): Promise<void>;
  markLessonFailed(lessonId: string, failureReason: string): Promise<void>;
  refinePromptWithSystemMessage(outline: string): Promise<string>;
  generateJSXWithGemini(prompt: string): Promise<string>;
  validateJSXStatic(jsx: string): Promise<{ valid: boolean; errors?: string[] }>;
  validateJSXRuntime(jsx: string): Promise<{ valid: boolean; errors?: string[] }>;
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

  await activities.getLessonById(lessonId);

  const logTasks: Promise<void>[] = [];

  const outcome = await runLessonGeneration(
    { outline, lessonId },
    {
      refinePrompt: (value) => activities.refinePromptWithSystemMessage(value),
      generateJSX: (prompt) => activities.generateJSXWithGemini(prompt),
      validateJSXStatic: (jsx) => activities.validateJSXStatic(jsx),
      validateJSXRuntime: (jsx) => activities.validateJSXRuntime(jsx),
      fixIssues: (jsx, errors) => activities.fixIssuesWithGemini(jsx, errors),
      storeJSX: async ({ lessonId: id, jsx }) => {
        if (!id) return undefined;
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
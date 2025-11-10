import { proxyActivities, workflowInfo } from '@temporalio/workflow';

import { runLessonGeneration } from '../generation/runner';
import type { LessonActivities } from './types';
import { LessonStatus } from './types';

const activities = proxyActivities<LessonActivities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '2s',
    maximumAttempts: 3,
  },
});

async function flushGenerationLogs(
  logTasks: Promise<void>[],
  lessonId: string,
  label: string = 'Final flush',
): Promise<void> {
  const results = await Promise.allSettled(logTasks);
  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(
      `[Temporal] ${label}: ${failures.length}/${logTasks.length} logs failed for lesson ${lessonId}`,
      failures.map((f) => (f.status === 'rejected' ? f.reason : null)),
    );
  }
}

export async function lessonGeneratorWorkflow(args: { lessonId: string; outline: string }) {
  const { lessonId, outline } = args;
  const { workflowId, runId } = workflowInfo();

  console.log(`[Workflow] Starting lesson generation for lesson ${lessonId}`);
  await activities.markLessonQueued(lessonId);
  console.log(`[Workflow] Lesson queued`);
  
  await activities.getLessonById(lessonId);
  console.log(`[Workflow] Lesson fetched from DB`);
  
  await activities.markLessonRunning(lessonId);
  console.log(`[Workflow] Lesson marked as running`);

  const logTasks: Promise<void>[] = [];

  let outcome;
  try {
    console.log(`[Workflow] Starting JSX generation pipeline...`);
    outcome = await runLessonGeneration(
    { outline, lessonId },
    {
      refinePrompt: async (value) => {
        await activities.markLessonStep(lessonId, LessonStatus.GENERATING_JSX);
        return activities.refinePromptWithSystemMessage(value);
      },
      generateImages: async (outline, refinedPrompt, lessonId) => {
        await activities.markLessonStep(lessonId || '', LessonStatus.GENERATING_IMAGES);
        return activities.generateImagesActivity(outline, refinedPrompt, lessonId || '');
      },
      generateJSX: async (prompt, images) => {
        await activities.markLessonStep(lessonId, LessonStatus.GENERATING_JSX);
        return activities.generateJSXWithGemini(prompt, images);
      },
      validateJSXStatic: async (jsx) => {
        await activities.markLessonStep(lessonId, LessonStatus.VALIDATING_JSX);
        return activities.validateJSXStatic(jsx);
      },
      validateJSXRuntime: async (jsx) => {
        await activities.markLessonStep(lessonId, LessonStatus.VALIDATING_JSX);
        return activities.validateJSXRuntime(jsx);
      },
      fixIssues: async (jsx, errors) => {
        await activities.markLessonStep(lessonId, LessonStatus.GENERATING_JSX);
        return activities.fixIssuesWithGemini(jsx, errors);
      },
      storeJSX: async ({ lessonId: id, jsx }) => {
        if (!id) return undefined;
        await activities.markLessonStep(id, LessonStatus.STORING_JSX);
        return activities.saveCompleteLesson(id, jsx);
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
          await flushGenerationLogs(logTasks, lessonId, 'Interim flush');
        },
      },
    },
  );
  } finally {
    // Ensure logs are flushed even if generation crashes
    console.log(`[Workflow] Flushing logs for lesson ${lessonId}...`);
    await flushGenerationLogs(logTasks, lessonId);
    console.log(`[Workflow] Logs flushed`);
  }

  if (outcome.status === 'completed') {
    console.log(`[Workflow] Lesson generation completed successfully`);
    return { lessonId, status: 'completed', jsxUrl: outcome.storage?.publicUrl ?? null };
  }

  console.log(`[Workflow] Lesson generation failed: ${outcome.error}`);
  return { lessonId, status: 'failed', error: outcome.error };
}
import { proxyActivities } from '@temporalio/workflow';

type LessonActivities = {
  getLessonById(lessonId: string): Promise<Record<string, unknown> | null>;
  markLessonCompleted(lessonId: string): Promise<void>;
};

const lessonActivities = proxyActivities<LessonActivities>({
  startToCloseTimeout: '1 minute',
});

export async function lessonGeneratorWorkflow(args: { lessonId: string; outline: string }) {
  const { lessonId, outline } = args;

  await lessonActivities.getLessonById(lessonId);
  await lessonActivities.markLessonCompleted(lessonId);

  return { lessonId, status: 'completed', outline };
}
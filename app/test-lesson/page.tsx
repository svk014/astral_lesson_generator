import { notFound } from "next/navigation";

import { LessonViewer } from "../lessons/[id]/LessonViewer";

export const dynamic = "force-dynamic";

async function loadTestLesson() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/test-lesson`);
    if (!response.ok) {
      throw new Error('Failed to fetch test lesson');
    }
    const data = await response.json();
    return { lesson: data, jsx: data.jsx, logs: [] } as const;
  } catch (error) {
    console.error('Failed to load test lesson', error);
    return null;
  }
}

export default async function TestLessonPage() {
  const result = await loadTestLesson();

  if (!result) {
    notFound();
  }

  const { lesson, jsx } = result;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Test Lesson</p>
          <h1 className="text-3xl font-semibold tracking-tight">{lesson.outline}</h1>
          <div className="text-sm text-muted-foreground">
            Loaded from: /api/test-lesson
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Generated Content</h2>
          <LessonViewer jsx={jsx} />
        </section>
      </div>
    </main>
  );
}
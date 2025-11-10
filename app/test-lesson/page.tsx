import { notFound } from "next/navigation";

import { HtmlLessonViewer } from "../lessons/[id]/HtmlLessonViewer";
import { LessonErrorBoundary } from "../lessons/[id]/LessonErrorBoundary";
import { loadTestLessonDirect } from "@/lib/test-lesson/loadTestLesson";

export const dynamic = "force-dynamic";

export default async function TestLessonPage() {
  const result = await loadTestLessonDirect();

  if (!result) {
    notFound();
  }

  const { lesson, renderedHtml } = result;

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
          <LessonErrorBoundary>
            <HtmlLessonViewer htmlContent={renderedHtml} />
          </LessonErrorBoundary>
        </section>
      </div>
    </main>
  );
}
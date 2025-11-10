import { notFound } from "next/navigation";

import { LessonErrorBoundary } from "../lessons/[id]/LessonErrorBoundary";
import LessonRenderer from "../lessons/[id]/LessonRenderer";

export const dynamic = "force-dynamic";

export default async function TestLessonPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Test Lesson</p>
          <h1 className="text-3xl font-semibold tracking-tight">Test lesson from sandbox output</h1>
          <div className="text-sm text-muted-foreground">
            Loaded from: sandbox/output.jsx
          </div>
        </header>

        <section className="space-y-4">
          <LessonErrorBoundary>
            <LessonRenderer lessonId="test-lesson" compiledJsPath="/api/compiled-js/test-lesson" />
          </LessonErrorBoundary>
        </section>
      </div>
    </main>
  );
}
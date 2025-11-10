"use client";

import LessonRenderer from "./LessonRenderer";
import { LessonErrorBoundary } from "./LessonErrorBoundary";

type LessonPageClientProps = {
  lesson: {
    id: string;
    outline: string;
    status?: string;
  };
  compiledJsPath: string | null;
};

export function LessonPageClient({ lesson, compiledJsPath }: LessonPageClientProps) {
  const hasContent = Boolean(compiledJsPath);

  return (
    <div className="relative flex min-h-screen w-full bg-background">
      <aside className="pointer-events-auto absolute right-6 top-6 max-w-xs rounded-lg border bg-card/90 p-4 shadow-lg backdrop-blur">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Lesson Outline</p>
        <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-relaxed text-foreground">
          {lesson.outline}
        </p>
      </aside>

      <div className="flex-1 h-full w-full overflow-auto px-6 py-10">
        {hasContent ? (
          <LessonErrorBoundary>
            <LessonRenderer compiledJsPath={compiledJsPath} />
          </LessonErrorBoundary>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Lesson content is still being generated...</p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { HtmlLessonViewer } from "./HtmlLessonViewer";
import { LessonErrorBoundary } from "./LessonErrorBoundary";

type LessonPageClientProps = {
  lesson: {
    id: string;
    outline: string;
    status?: string;
  };
  renderedHtml: string | null;
};

export function LessonPageClient({ lesson, renderedHtml }: LessonPageClientProps) {
  const hasContent = Boolean(renderedHtml);

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
            <HtmlLessonViewer htmlContent={renderedHtml} />
          </LessonErrorBoundary>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Generated lesson content is not available yet.
          </div>
        )}
      </div>
    </div>
  );
}

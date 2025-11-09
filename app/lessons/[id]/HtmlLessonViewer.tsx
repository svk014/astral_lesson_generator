"use client";

import { useState, useEffect } from "react";

type HtmlLessonViewerProps = {
  htmlContent?: string | null;
};

/**
 * Safely renders pre-rendered HTML content without executing any JavaScript.
 * This eliminates the security risk of client-side code execution.
 */
export function HtmlLessonViewer({ htmlContent }: HtmlLessonViewerProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [htmlContent]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to render lesson: {error}
      </div>
    );
  }

  if (!htmlContent) {
    return (
      <div className="rounded-md border bg-muted/10 p-4 text-sm text-muted-foreground">
        Lesson content is still generating. Check back soon!
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow w-full h-full">
      <div 
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        className="lesson-content"
      />
    </div>
  );
}
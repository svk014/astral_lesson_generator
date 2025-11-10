"use client";

type HtmlLessonViewerProps = {
  htmlContent?: string | null;
};

export function HtmlLessonViewer({ htmlContent }: HtmlLessonViewerProps) {
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
"use client";

import { useState } from "react";

import { LessonViewer } from "./LessonViewer";

type LessonPageClientProps = {
  lesson: {
    id: string;
    outline: string;
    status?: string;
  };
  jsx: string | null;
};

export function LessonPageClient({ lesson, jsx }: LessonPageClientProps) {
  const [open, setOpen] = useState(false);
  const hasContent = Boolean(jsx);

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <div className="w-full bg-muted border-b px-4 py-2 flex items-center">
        <button
          className="mr-2 px-2 py-1 rounded bg-primary text-white text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide Outline" : "Show Outline"}
        </button>
        {open && (
          <div className="text-sm text-muted-foreground whitespace-pre-line flex-1">
            {lesson.outline}
          </div>
        )}
      </div>

      <div className="flex-1 w-full h-full overflow-auto">
        {hasContent ? (
          <LessonViewer jsx={jsx ?? undefined} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Generated lesson content is not available yet.
          </div>
        )}
      </div>
    </div>
  );
}

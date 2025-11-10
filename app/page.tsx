"use client";

import Link from "next/link";
import { useState, useCallback, useMemo } from "react";
import { useLessons } from "@/lib/hooks/useLesson";
import { useSubmitOutline } from "@/lib/hooks/useSubmitOutline";

const statusStyles: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  queued: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  running: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  generating_images: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200",
  generating_jsx: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200",
  validating_jsx: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200",
  storing_jsx: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-200",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-200",
  cancelled: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200",
  timeout: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200",
};

const statusDotStyles: Record<string, string> = {
  pending: "bg-slate-500",
  queued: "bg-blue-500",
  running: "bg-amber-500",
  generating_images: "bg-orange-500",
  generating_jsx: "bg-purple-500",
  validating_jsx: "bg-indigo-500",
  storing_jsx: "bg-cyan-500",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  cancelled: "bg-orange-500",
  timeout: "bg-gray-500",
};

export default function Home() {
  const [outline, setOutline] = useState("");
  const [page, setPage] = useState(0);
  const limit = 10;
  const offset = page * limit;

  // React Query hooks for automatic polling
  const { data: lessonsData, isLoading: lessonsLoading } = useLessons(limit, offset);
  const { mutate: submitOutline, isPending: isSubmitting } = useSubmitOutline();

  const lessons = lessonsData || [];
  // If we get fewer items than the limit, we've reached the end
  const hasNextPage = lessons.length === limit;

  // Memoize formatted dates to avoid recreating Date objects on every render
  const formattedLessons = useMemo(
    () =>
      lessons.map((lesson) => ({
        ...lesson,
        formattedDate: new Date(lesson.created_at).toLocaleString(),
      })),
    [lessons]
  );

  // Memoize callback to prevent unnecessary re-renders if passed to children
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!outline.trim()) return;
      
      submitOutline({ outline }, {
        onSuccess: () => {
          setOutline("");
          setPage(0);
        },
      });
    },
    [outline, submitOutline]
  );

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-row gap-8 px-6 py-6 h-[calc(100vh-32px)]">
        {/* Left: Generator */}
        <div className="flex flex-col flex-1 max-w-md">
          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Astral Lesson Generator</h1>
            <p className="mt-2 text-sm text-muted-foreground">Provide a lesson outline and track generation progress all in one place.</p>
          </header>
          <form
            className="flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm"
            onSubmit={handleSubmit}
          >
            <div className="space-y-2">
              <label htmlFor="lesson-outline" className="text-sm font-medium">Lesson Outline</label>
              <textarea
                id="lesson-outline"
                name="lesson-outline"
                placeholder="Example: Cover the key concepts of constellations for middle school students..."
                className="min-h-[160px] w-full resize-y rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={outline}
                onChange={e => setOutline(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                disabled={isSubmitting || !outline.trim()}
              >
                {isSubmitting ? "Generating..." : "Generate"}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Lesson List */}
        <div className="flex flex-col flex-[2] min-w-[400px] max-w-2xl h-full relative">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Recent Lessons</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Click a lesson title to open it.</span>
              {lessonsLoading && (
                <span className="text-xs text-muted-foreground animate-pulse">Updating...</span>
              )}
            </div>
          </div>
          <div className="overflow-y-auto rounded-lg border flex-1 pb-20">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Lesson Outline</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card/80">
                {formattedLessons.map((lesson) => (
                  <tr key={lesson.id} className="transition hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/lessons/${lesson.id}`}
                        className="font-medium text-primary hover:underline"
                        title={lesson.outline}
                      >
                        <span className="max-w-[320px] truncate block">
                          {lesson.outline.length > 80
                            ? `${lesson.outline.slice(0, 77)}...`
                            : lesson.outline}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[lesson.status] ?? statusStyles.running}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${statusDotStyles[lesson.status] ?? statusDotStyles.running}`}
                        />
                        {lesson.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{lesson.formattedDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="absolute left-0 right-0 bottom-0 flex justify-between items-center bg-background py-3 px-4 border-t z-20">
            <button
              className="px-3 py-1 rounded bg-muted text-xs"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </button>
            <span className="text-xs">Page {page + 1}</span>
            <button
              className="px-3 py-1 rounded bg-muted text-xs"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

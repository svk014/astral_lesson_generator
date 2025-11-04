"use client";

import Link from "next/link";

import { useState, useEffect, useCallback } from "react";

const statusStyles: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  queued: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  running: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
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
  generating_jsx: "bg-purple-500",
  validating_jsx: "bg-indigo-500",
  storing_jsx: "bg-cyan-500",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  cancelled: "bg-orange-500",
  timeout: "bg-gray-500",
};

type LessonApiRow = {
  id: string;
  outline: string;
  status: string;
  created_at: string;
  jsx_public_url: string | null;
  error_message: string | null;
};

export default function Home() {
  const [lessons, setLessons] = useState<LessonApiRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [outline, setOutline] = useState("");
  const limit = 10;

  const fetchLessons = useCallback(async (pageNum: number) => {
    const res = await fetch(`/api/lessons?limit=${limit}&offset=${pageNum * limit}`);
    const data = await res.json();
    setLessons(data.lessons || []);
    setTotal(data.total || 0);
  }, [limit]);

  useEffect(() => {
    fetchLessons(page).catch((error) => {
      console.error("Failed to load lessons", error);
    });
  }, [page, fetchLessons]);

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
            onSubmit={async (e) => {
              e.preventDefault();
              if (!outline.trim()) return;
              setGenerating(true);
              try {
                await fetch("/api/lessons", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ outline }),
                });
                setOutline("");
                setPage(0);
                await fetchLessons(0);
              } finally {
                setGenerating(false);
              }
            }}
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
                disabled={generating}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                disabled={generating || !outline.trim()}
              >
                {generating ? "Generating..." : "Generate"}
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
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted/80 border border-border"
                title="Refresh lesson list"
                onClick={async () => {
                  setRefreshing(true);
                  try {
                    await fetchLessons(page);
                  } finally {
                    setRefreshing(false);
                  }
                }}
                disabled={refreshing}
              >
                &#x21bb; Refresh
              </button>
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
                {lessons.map((lesson) => (
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
                    <td className="px-4 py-3 text-right">{new Date(lesson.created_at).toLocaleString()}</td>
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
            <span className="text-xs">Page {page + 1} of {Math.max(1, Math.ceil(total / limit))}</span>
            <button
              className="px-3 py-1 rounded bg-muted text-xs"
              onClick={() => setPage((p) => (p + 1 < Math.ceil(total / limit) ? p + 1 : p))}
              disabled={page + 1 >= Math.ceil(total / limit)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

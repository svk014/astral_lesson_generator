"use client";

import Link from "next/link";

import { useState, useEffect, useCallback } from "react";

const statusStyles: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  running: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-200",
  queued: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-200",
};

const statusDotStyles: Record<string, string> = {
  completed: "bg-emerald-500",
  running: "bg-amber-500",
  failed: "bg-red-500",
  queued: "bg-slate-500",
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
  const [loading, setLoading] = useState(false);
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
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 py-12">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Astral Lesson Generator
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Provide a lesson outline and track generation progress all in one place.
          </p>
        </header>

        <section>
          <form
            className="flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!outline.trim()) return;
              setLoading(true);
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
                setLoading(false);
              }
            }}
          >
            <div className="space-y-2">
              <label htmlFor="lesson-outline" className="text-sm font-medium">
                Lesson Outline
              </label>
              <textarea
                id="lesson-outline"
                name="lesson-outline"
                placeholder="Example: Cover the key concepts of constellations for middle school students..."
                className="min-h-[160px] w-full resize-y rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={outline}
                onChange={e => setOutline(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                disabled={loading || !outline.trim()}
              >
                {loading ? "Generating..." : "Generate"}
              </button>
            </div>
          </form>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Lessons</h2>
            <span className="text-xs text-muted-foreground">
              Click a lesson title to open it.
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Lesson Outline
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">
                    Created At
                  </th>
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
                    <td className="px-4 py-3 text-right">
                      {new Date(lesson.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-4">
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
        </section>
      </div>
    </main>
  );
}

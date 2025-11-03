import { notFound } from "next/navigation";

import { getServiceSupabaseClient } from "@/lib/supabase/server";

import { LessonViewer } from "./LessonViewer";

export const dynamic = "force-dynamic";

const storageBucket = process.env.SUPABASE_STORAGE_BUCKET ?? "lessons";

async function loadLesson(id: string) {
  const supabase = getServiceSupabaseClient();

  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load lesson: ${error.message}`);
  }

  if (!lesson) {
    return null;
  }

  let jsx: string | null = null;

  const { data: logs, error: logsError } = await supabase
    .from("lesson_generation_logs")
    .select("id, step, attempt, status, info, event_timestamp")
    .eq("lesson_id", id)
    .order("event_timestamp", { ascending: true });

  if (logsError) {
    console.error("Failed to load lesson generation logs", logsError);
  }

  if (lesson.jsx_storage_path) {
    const { data: file, error: downloadError } = await supabase.storage
      .from(storageBucket)
      .download(lesson.jsx_storage_path);

    if (!downloadError && file) {
      jsx = await file.text();
    }
  }

  return { lesson, jsx, logs: logs ?? [] } as const;
}

export default async function LessonPage({ params }: { params: { id: string } }) {
  const data = await loadLesson(params.id);

  if (!data) {
    notFound();
  }

  const { lesson, jsx, logs } = data;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Lesson</p>
          <h1 className="text-3xl font-semibold tracking-tight">{lesson.outline}</h1>
          <div className="text-sm text-muted-foreground">
            Status: <span className="font-medium text-foreground">{lesson.status}</span>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Generated Content</h2>
          <LessonViewer jsx={jsx} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Generation Logs</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No log entries yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-md border bg-muted/10 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
                    <span className="font-semibold text-foreground">{log.step}</span>
                    <span>Attempt {log.attempt}</span>
                    <span className={log.status === "success" ? "text-emerald-600" : "text-destructive"}>
                      {log.status}
                    </span>
                    <span>{new Date(log.event_timestamp).toLocaleString()}</span>
                  </div>
                  {log.info ? (
                    <pre className="mt-2 overflow-auto rounded bg-background/60 p-2 text-xs">
                      {JSON.stringify(log.info, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Debug Info</h2>
          <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/10 p-4 text-xs text-muted-foreground">
            {JSON.stringify(
              {
                createdAt: lesson.created_at,
                status: lesson.status,
                jsxPublicUrl: lesson.jsx_public_url,
                error: lesson.error_message,
                logs,
              },
              null,
              2,
            )}
          </pre>
        </section>
      </div>
    </main>
  );
}

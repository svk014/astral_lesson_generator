import { notFound } from "next/navigation";

import { loadLessonWithJsx } from "@/lib/lessons/loadLessonWithJsx";

import { LessonPageClient } from "./LessonPageClient";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const payload = await loadLessonWithJsx(id);

  if (!payload) {
    notFound();
  }

  const { lesson, renderedHtml } = payload;

  return (
    <LessonPageClient
      lesson={{
        id: lesson.id,
        outline: typeof lesson.outline === "string" ? lesson.outline : String(lesson.outline ?? ""),
        status: typeof lesson.status === "string" ? lesson.status : undefined,
      }}
      renderedHtml={renderedHtml}
    />
  );
}

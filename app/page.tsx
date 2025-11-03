import Link from "next/link";

type LessonStatus = "Generating" | "Generated";

interface LessonRow {
  id: number;
  title: string;
  status: LessonStatus;
  href: string;
}

const lessons: LessonRow[] = [
  {
    id: 1,
    title: "Introduction to the Solar System",
    status: "Generated",
    href: "#lesson-1",
  },
  {
    id: 2,
    title: "Phases of the Moon",
    status: "Generating",
    href: "#lesson-2",
  },
  {
    id: 3,
    title: "Life Cycle of Stars",
    status: "Generated",
    href: "#lesson-3",
  },
];

const statusStyles: Record<LessonStatus, string> = {
  Generated:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  Generating:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
};

const statusDotStyles: Record<LessonStatus, string> = {
  Generated: "bg-emerald-500",
  Generating: "bg-amber-500",
};

export default function Home() {
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
          <form className="flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <label htmlFor="lesson-outline" className="text-sm font-medium">
                Lesson Outline
              </label>
              <textarea
                id="lesson-outline"
                name="lesson-outline"
                placeholder="Example: Cover the key concepts of constellations for middle school students..."
                className="min-h-[160px] w-full resize-y rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Generate
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
                    Lesson Title
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card/80">
                {lessons.map((lesson) => (
                  <tr key={lesson.id} className="transition hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        href={lesson.href}
                        className="font-medium text-primary hover:underline"
                      >
                        {lesson.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[lesson.status]}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${statusDotStyles[lesson.status]}`}
                        />
                        {lesson.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={lesson.href}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

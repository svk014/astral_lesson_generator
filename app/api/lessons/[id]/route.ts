import { NextRequest, NextResponse } from 'next/server';

import { loadLessonWithJsx } from '@/lib/lessons/loadLessonWithJsx';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: lessonId } = await context.params;
  try {
    const payload = await loadLessonWithJsx(lessonId);

    if (!payload) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to fetch lesson', error);
    return NextResponse.json({ error: 'Failed to fetch lesson' }, { status: 500 });
  }
}

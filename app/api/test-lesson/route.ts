import { NextResponse } from 'next/server';
import { loadTestLessonDirect } from '@/lib/test-lesson/loadTestLesson';

export async function GET() {
  try {
    const result = await loadTestLessonDirect();

    if (!result) {
      return NextResponse.json({ error: 'Test lesson not found' }, { status: 404 });
    }

    return NextResponse.json(result.lesson);
  } catch (error) {
    console.error('Failed to load test lesson', error);
    return NextResponse.json({ error: 'Failed to load test lesson' }, { status: 500 });
  }
}
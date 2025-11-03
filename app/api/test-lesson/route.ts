import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(_request: NextRequest) {
  try {
    const outputPath = path.join(process.cwd(), 'sandbox', 'output.jsx');
    const jsx = await fs.readFile(outputPath, 'utf-8');

    // Mock response similar to lesson API
    const mockLesson = {
      id: 'test-lesson',
      outline: 'Test lesson from harness output',
      jsx,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(mockLesson);
  } catch (error) {
    console.error('Failed to load test lesson', error);
    return NextResponse.json({ error: 'Failed to load test lesson' }, { status: 500 });
  }
}
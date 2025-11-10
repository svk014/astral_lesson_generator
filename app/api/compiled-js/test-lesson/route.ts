import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { compileJsxToJs } from '@/lib/generation/jsxCompiler';

/**
 * Serves compiled JS for test-lesson from sandbox/output.jsx
 * This follows the same pattern as regular lessons in /api/compiled-js/[lessonId]
 */
export async function GET() {
  try {
    const outputPath = path.join(process.cwd(), 'sandbox', 'output.jsx');
    const jsxSource = await fs.readFile(outputPath, 'utf-8');

    // Compile the JSX to JavaScript
    const compiledCode = compileJsxToJs(jsxSource);

    // Return as JavaScript with proper content type so it can be dynamically imported
    return new NextResponse(compiledCode, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Failed to load test lesson', error);
    return NextResponse.json({ error: 'Failed to load test lesson' }, { status: 500 });
  }
}

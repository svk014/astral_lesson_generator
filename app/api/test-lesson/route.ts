import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { compileJsxToJs } from '@/lib/generation/jsxCompiler';

export async function GET() {
  try {
    const outputPath = path.join(process.cwd(), 'sandbox', 'output.jsx');
    const jsxSource = await fs.readFile(outputPath, 'utf-8');

    // Compile the JSX to JavaScript
    let compiledCode: string;
    try {
      compiledCode = compileJsxToJs(jsxSource);
    } catch (compileError) {
      console.error('Failed to compile JSX', compileError);
      return NextResponse.json(
        { error: 'Failed to compile JSX', details: compileError instanceof Error ? compileError.message : String(compileError) },
        { status: 500 }
      );
    }

    // Mock response similar to lesson API
    const mockLesson = {
      id: 'test-lesson',
      outline: 'Test lesson from harness output',
      jsxSource,
      compiledCode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(mockLesson);
  } catch (error) {
    console.error('Failed to load test lesson', error);
    return NextResponse.json({ error: 'Failed to load test lesson' }, { status: 500 });
  }
}
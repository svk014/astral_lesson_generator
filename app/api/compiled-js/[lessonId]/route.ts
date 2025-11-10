import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/compiled-js/:lessonId
 * 
 * Serves compiled JS for a lesson with proper CORS and Content-Type headers
 * This bypasses CORS issues with direct Supabase storage access
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;

    if (!lessonId || typeof lessonId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid lesson ID' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabaseClient();

    // Look up the lesson to get the compiled JS path
    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('compiled_js_path')
      .eq('id', lessonId)
      .maybeSingle();

    if (error) {
      console.error('Failed to look up lesson:', error);
      return NextResponse.json(
        { error: 'Failed to look up lesson' },
        { status: 500 }
      );
    }

    if (!lesson || !lesson.compiled_js_path) {
      return NextResponse.json(
        { error: 'Compiled JS not found for this lesson' },
        { status: 404 }
      );
    }

    // Fetch the compiled JS from the public URL
    const response = await fetch(lesson.compiled_js_path);
    
    if (!response.ok) {
      console.error('Failed to fetch compiled JS from public URL:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch compiled JS from storage' },
        { status: 500 }
      );
    }

    const jsCode = await response.text();

    // Return with proper headers for ES module
    return new Response(jsCode, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Compiled JS serve error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

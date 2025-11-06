import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/images/:shortHash
 * 
 * Serves images by short hash, redirecting to Supabase storage
 * This prevents long URLs from being embedded in JSX
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ shortHash: string }> }
) {
  try {
    const { shortHash } = await params;

    if (!shortHash || typeof shortHash !== 'string') {
      return NextResponse.json(
        { error: 'Invalid short hash' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabaseClient();

    // Look up the image by short hash
    const { data: imageMapping, error } = await supabase
      .from('lesson_images')
      .select('storage_path, title, description')
      .eq('short_hash', shortHash)
      .maybeSingle();

    if (error) {
      console.error('Failed to look up image mapping:', error);
      return NextResponse.json(
        { error: 'Failed to look up image' },
        { status: 500 }
      );
    }

    if (!imageMapping) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Get the public URL from Supabase Storage
    const { data } = supabase.storage
      .from('lessons')
      .getPublicUrl(imageMapping.storage_path);

    if (!data.publicUrl) {
      return NextResponse.json(
        { error: 'Failed to generate storage URL' },
        { status: 500 }
      );
    }

    // Redirect to Supabase storage
    return NextResponse.redirect(data.publicUrl, { status: 307 });
  } catch (error) {
    console.error('Image lookup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

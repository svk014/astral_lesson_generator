import { createClient } from '@supabase/supabase-js';
import { env } from '../../env';
import { generateJSXWithGemini as generateJSXService } from '../../generation/services';
import { generateAndStoreImages } from '../../generation/imageGeneration';

// Re-export services for use as activities
export { refinePromptWithSystemMessage, fixIssuesWithGemini } from '../../generation/services';

/** Wrapper for JSX generation that accepts images */
export async function generateJSXWithGemini(
  prompt: string,
  images?: Array<{ id: string; title: string; shortUrl: string; description: string }>,
): Promise<string> {
  return generateJSXService(prompt, images);
}

/** Generate images and store in Supabase for use in lesson */
export async function generateImagesActivity(
  outline: string,
  refinedPrompt: string,
  lessonId: string,
) {
  const supabaseClient = createClient(env.supabase.url, env.supabase.serviceKey);
  return generateAndStoreImages(outline, refinedPrompt, lessonId, supabaseClient);
}

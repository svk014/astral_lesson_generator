import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { stripJsonFence } from '../utils';
import fetch from 'node-fetch';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY not set');

const gemini = new GoogleGenerativeAI(apiKey);
const textModel = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });

export interface ImageDescription {
  id: string;
  title: string;
  description: string;
  context: string;
}

/**
 * Ask Gemini to describe what images would enhance this lesson
 */
export async function generateImageDescriptions(
  outline: string,
  refinedPrompt: string
): Promise<ImageDescription[]> {
  const prompt = `You are an educational content designer. For this lesson outline, suggest 2-3 images that would significantly enhance student understanding.

Lesson Outline: "${outline}"

For each image, provide:
1. A clear visual description (what the image should depict)
2. Why it helps learning
3. Any specific elements, text, or labels

Output as JSON array (no markdown):
[
  {
    "id": "image_1",
    "title": "Image Title",
    "description": "Detailed description for image generation: include objects, colors, composition, style, any text/labels",
    "context": "Why this image helps: explanation of learning value"
  }
]

Keep descriptions 1-2 sentences, visual and specific. Be suitable for students.`;

  const result = await textModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const raw = result?.response?.text();
  if (!raw) {
    throw new Error('Gemini did not return image descriptions');
  }

  const sanitized = stripJsonFence(raw);
  const parsed = JSON.parse(sanitized) as ImageDescription[];
  const timestamp = Date.now();
  return parsed.map((img, idx) => ({
    ...img,
    id: `image_${idx + 1}_${timestamp}`,
  }));
}

export interface GeneratedImage {
  id: string;
  title: string;
  imageData: string; // base64
  mimeType: string;
  generationPrompt: string; // what we asked Imagen to create
  description?: string; // Gemini's description of generated image
}

/**
 * Generate images using Gemini 2.5 Flash Image model
 * Returns base64-encoded images for storage
 * Cost: Token-based (~1290 tokens per image)
 */
export async function generateImagesWithGemini(
  descriptions: ImageDescription[]
): Promise<GeneratedImage[]> {
  const images: GeneratedImage[] = [];

  for (const desc of descriptions) {
    const prompt = `Generate an educational illustration based on this description:

"${desc.description}"

Context: ${desc.context}

Create a clear, professional educational image suitable for students. Use good composition, appropriate colors, and include any specified text or labels.`;

    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey!,
        } as Record<string, string>,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to generate image: ${response.status} ${error}`);
      }

      const data = (await response.json()) as any;
      
      // Find both image and text parts in the response
      let imagePart = null;
      let textPart = null;
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data && !imagePart) {
          imagePart = part;
        }
        if (part.text && !textPart) {
          textPart = part;
        }
      }

      if (!imagePart?.inlineData?.data) {
        console.error(`[ImageGen] No image found in response for ${desc.id}. Parts:`, JSON.stringify(parts, null, 2));
        throw new Error(`Failed to generate image for ${desc.id}: no inline data in response`);
      }

      const mimeType = imagePart.inlineData?.mimeType ?? 'image/png';
      // Use the description from Gemini's response if available, otherwise use the original description
      const generatedDescription = textPart?.text || desc.description;

      images.push({
        id: desc.id,
        title: desc.title,
        imageData: imagePart.inlineData.data,
        mimeType,
        generationPrompt: prompt,
        description: generatedDescription,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate image for ${desc.id}: ${message}`);
    }
  }

  return images;
}

/**
 * Ask Gemini to describe what's in the generated image
 * Used for alt text and display descriptions
 */
export async function describeGeneratedImage(
  imageData: string,
  mimeType: string
): Promise<string> {
  const prompt = `Describe this educational image in 1-2 concise sentences suitable for alt text and student learning. 
Focus on what's shown and its educational value. Be specific but brief.`;

  const result = await textModel.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: imageData,
            },
          },
        ],
      },
    ],
  });

  const raw = result?.response?.text();
  if (!raw) {
    throw new Error('Gemini did not return image description');
  }

  return raw.trim();
}

/**
 * Generate short hash for image URL mapping
 */
export function generateShortHash(): string {
  return createHash('sha256').update(randomUUID()).digest('hex').substring(0, 12);
}

/**
 * Upload generated image to Supabase Storage
 * Returns storage path (not public URL - we'll use short hash API instead)
 */
export async function uploadImageToSupabase(
  image: GeneratedImage,
  lessonId: string,
  supabase: any
): Promise<string> {
  // Convert base64 to buffer
  const buffer = Buffer.from(image.imageData, 'base64');

  // Determine file extension from mime type
  const ext = image.mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `lessons/${lessonId}/${image.id}.${ext}`;

  // Upload to storage
  const { error } = await supabase.storage.from('lessons').upload(path, buffer, {
    contentType: image.mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload image ${image.id} to storage: ${error.message}`);
  }

  return path;
}

/**
 * Store image mapping in Supabase
 * Creates short hash → storage path mapping
 */
export async function storeImageMapping(
  lessonId: string,
  title: string,
  description: string,
  storagePath: string,
  supabase: any
): Promise<{ shortHash: string; shortUrl: string }> {
  const shortHash = generateShortHash();
  const shortUrl = `/api/images/${shortHash}`;

  const { error } = await supabase
    .from('lesson_images')
    .insert({
      lesson_id: lessonId,
      short_hash: shortHash,
      storage_path: storagePath,
      title,
      description,
    });

  if (error) {
    throw new Error(`Failed to store image mapping: ${error.message}`);
  }

  return { shortHash, shortUrl };
}

/**
 * Process full image generation pipeline (Option 2 - with image descriptions):
 * 1. Ask Gemini what images would help → Get generation prompts
 * 2. Generate images with Imagen 4 Fast
 * 3. Ask Gemini to describe generated images → Get alt text
 * 4. Upload images to Supabase Storage
 * 5. Store short hash mappings in DB
 * 6. Return short URLs + descriptions for JSX generation
 */
export async function generateAndStoreImages(
  outline: string,
  refinedPrompt: string,
  lessonId: string,
  supabase: any,
  recordLog?: (entry: any) => Promise<void> | void
): Promise<{ id: string; title: string; shortUrl: string; description: string }[]> {
  const startTime = Date.now();

  try {
    // Step 1: Generate image descriptions
    console.log(`[ImageGen] Step 1: Generating image descriptions for lesson ${lessonId}...`);
    await recordLog?.({
      step: 'image_generation_step_1_descriptions',
      status: 'success',
      info: { message: 'Starting Step 1: Generate image descriptions', lessonId },
      attempt: 0,
    });

    const descriptions = await generateImageDescriptions(outline, refinedPrompt);
    console.log(`[ImageGen] ✓ Step 1 complete: Generated ${descriptions.length} image descriptions`);
    await recordLog?.({
      step: 'image_generation_step_1_descriptions',
      status: 'success',
      info: { message: 'Step 1 complete', count: descriptions.length, lessonId },
      attempt: 0,
    });

    // Step 2: Generate images
    console.log(`[ImageGen] Step 2: Generating images with Gemini 2.5 Flash Image...`);
    await recordLog?.({
      step: 'image_generation_step_2_generate',
      status: 'success',
      info: { message: 'Starting Step 2: Generate images with Gemini 2.5 Flash Image', count: descriptions.length, lessonId },
      attempt: 0,
    });

    const generatedImages = await generateImagesWithGemini(descriptions);
    console.log(`[ImageGen] ✓ Step 2 complete: Generated ${generatedImages.length} images`);
    await recordLog?.({
      step: 'image_generation_step_2_generate',
      status: 'success',
      info: { message: 'Step 2 complete', count: generatedImages.length, lessonId },
      attempt: 0,
    });

    // Step 3-5: Process each image
    console.log(`[ImageGen] Step 3-5: Processing ${generatedImages.length} images...`);
    const results: { id: string; title: string; shortUrl: string; description: string }[] = [];

    for (const image of generatedImages) {
      try {
        // Use the description from image generation (Step 2)
        console.log(`[ImageGen]   Processing image ${image.id}...`);
        await recordLog?.({
          step: `image_generation_step_3_process_${image.id}`,
          status: 'success',
          info: { message: `Using generated description for image`, imageId: image.id, description: image.description?.substring(0, 100), lessonId },
          attempt: 0,
        });

        const description = image.description || image.title;

        // Upload to Supabase Storage
        console.log(`[ImageGen]   Uploading image ${image.id} to storage...`);
        await recordLog?.({
          step: `image_generation_step_4_upload_${image.id}`,
          status: 'success',
          info: { message: 'Starting upload to storage', imageId: image.id, lessonId },
          attempt: 0,
        });

        const storagePath = await uploadImageToSupabase(image, lessonId, supabase);
        console.log(`[ImageGen]   ✓ Image ${image.id} uploaded to ${storagePath}`);
        await recordLog?.({
          step: `image_generation_step_4_upload_${image.id}`,
          status: 'success',
          info: { message: 'Upload complete', imageId: image.id, storagePath, lessonId },
          attempt: 0,
        });

        // Store mapping and get short URL
        console.log(`[ImageGen]   Creating short hash mapping for image ${image.id}...`);
        await recordLog?.({
          step: `image_generation_step_5_mapping_${image.id}`,
          status: 'success',
          info: { message: 'Creating DB mapping', imageId: image.id, lessonId },
          attempt: 0,
        });

        const { shortUrl, shortHash } = await storeImageMapping(
          lessonId,
          image.title,
          description,
          storagePath,
          supabase
        );
        console.log(`[ImageGen]   ✓ Image ${image.id} mapped: ${shortUrl}`);
        await recordLog?.({
          step: `image_generation_step_5_mapping_${image.id}`,
          status: 'success',
          info: { message: 'Mapping created', imageId: image.id, shortHash, shortUrl, lessonId },
          attempt: 0,
        });

        results.push({
          id: image.id,
          title: image.title,
          shortUrl,
          description,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ImageGen]   ✗ Failed to process image ${image.id}: ${message}`);
        await recordLog?.({
          step: `image_generation_step_3_5_process_${image.id}`,
          status: 'failure',
          info: { message: 'Failed to process image', imageId: image.id, error: message, lessonId },
          attempt: 0,
        });
        throw error;
      }
    }

    // Step 6: Complete
    const totalTime = Date.now() - startTime;
    console.log(`[ImageGen] ✓ Step 6 complete: All ${results.length} images processed successfully in ${totalTime}ms`);
    await recordLog?.({
      step: 'image_generation_step_6_complete',
      status: 'success',
      info: { message: 'Image generation pipeline complete', count: results.length, totalTimeMs: totalTime, lessonId },
      attempt: 0,
    });

    return results;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ImageGen] ✗ Pipeline failed after ${totalTime}ms: ${message}`);
    await recordLog?.({
      step: 'image_generation_pipeline_error',
      status: 'failure',
      info: { message: 'Image generation pipeline failed', error: message, totalTimeMs: totalTime, lessonId },
      attempt: 0,
    });
    throw error;
  }
}

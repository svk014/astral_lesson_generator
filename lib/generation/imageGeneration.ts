import { Buffer } from 'node:buffer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateShortHash } from '../utils';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI } from '@google/genai';
import { stripJsonFence } from '../utils';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY not set');

const gemini = new GoogleGenerativeAI(apiKey);
const textModel = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
const imageAi = new GoogleGenAI({ apiKey });

export interface ImageDescription {
  id: string;
  title: string;
  description: string;
  context: string;
}

export async function generateImageDescriptions(
  outline: string
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
      const response = await imageAi.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
      });

      if (!response.candidates || !response.candidates[0]) {
        throw new Error(`Failed to generate image for ${desc.id}: no candidates in response`);
      }

      // Find both image and text parts in the response
      let imagePart = null;
      let textPart = null;
      const parts = response.candidates[0].content?.parts || [];
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

export async function uploadImageToSupabase(
  image: GeneratedImage,
  lessonId: string,
  supabase: SupabaseClient
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

export async function storeImageMapping(
  lessonId: string,
  title: string,
  description: string,
  storagePath: string,
  supabase: SupabaseClient
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

export async function generateAndStoreImages(
  outline: string,
  refinedPrompt: string,
  lessonId: string,
  supabase: SupabaseClient,
  recordLog?: (entry: Record<string, unknown>) => Promise<void> | void
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

    const descriptions = await generateImageDescriptions(outline);
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

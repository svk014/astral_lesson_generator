import * as ts from 'typescript';

import { stripJsonFence } from '../utils';
import { geminiModel } from '../gemini/client';
import { generationConfig } from './runtimeValidation';
import { jsxResponseSchema, validationResultSchema, type ValidationResult } from './schemas';

export { validateJSXRuntime } from './runtimeValidation';

function parseJsxFromResponse(raw: string): string {
  const sanitized = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized);
  } catch (error) {
    throw new Error(`Gemini returned invalid JSON: ${(error as Error).message}`);
  }

  const parseResult = jsxResponseSchema.safeParse(parsed);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid JSX response: ${issues}`);
  }

  const { jsx } = parseResult.data;
  const trimmedJsx = jsx.trim();
  if (!trimmedJsx) {
    throw new Error('Gemini returned an empty JSX string');
  }
  return trimmedJsx;
}

export async function refinePromptWithSystemMessage(outline: string): Promise<string> {
  return `You are an expert React educator. Generate a standalone JSX component for this lesson outline: "${outline}". Requirements: Output only JSX code, nothing else. Use emojis for visual elements where possible. Code must compile and render without errors. Declare exactly one top-level component and end the file with "export default <ComponentName>;". Do not emit additional exports or helpers. No external dependencies except React. The component must occupy the full viewport (set a root wrapper with minHeight 100vh and width 100%), include generous but minimalist padding, and present content in a clean, spacious layout suitable for desktop. The design must look great in a dark theme (dark backgrounds, light text, good contrast, and visually pleasing accent colors).`;
}

export async function generateJSXWithGemini(
  prompt: string,
  images?: Array<{ id: string; title: string; shortUrl: string; description: string }>
): Promise<string> {
  const imageContext = images
    ? `\n\nEducational images are available for this lesson:\n${images
        .map((img) => `- ${img.id} (${img.title}): ${img.shortUrl}\n  Description: ${img.description}`)
        .join('\n')}\n\nInclude these images in the JSX using <img src="{shortUrl}" alt="{description}" /> tags. Use the exact short URLs provided above.`
    : '';

  const contentPrompt = `${prompt}${imageContext}

Respond strictly as minified JSON with the following shape:
{
  "jsx": "<JSX string>",
  "notes": "optional observations"
}

Do not include Markdown fences or commentary outside the JSON.`;

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: contentPrompt }]}],
    generationConfig,
  });

  const raw = result?.response?.text();
  if (!raw) {
    throw new Error('Gemini did not return any content');
  }

  return parseJsxFromResponse(raw);
}

export async function validateJSXStatic(jsx: string): Promise<ValidationResult> {
  try {
    const transpileResult = ts.transpileModule(jsx, {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
      fileName: 'InlineLessonComponent.tsx',
      reportDiagnostics: true,
    });
    const diagnostics = transpileResult.diagnostics ?? [];
    if (diagnostics.length > 0) {
      const messages = diagnostics.map((diag) => {
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        if (diag.file && typeof diag.start === 'number') {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
          const formattedLine = line + 1;
          const formattedChar = character + 1;
          const sourceLine = diag.file.text.split(/\r?\n/)[line] ?? '';
          const snippet = sourceLine.trim() ? `\n→ ${sourceLine.trim()}` : '';
          return `TS${diag.code} (${formattedLine},${formattedChar}): ${message}${snippet}`;
        }
        return `TS${diag.code}: ${message}`;
      });
      const result: ValidationResult = { valid: false, errors: messages };
      return validationResultSchema.parse(result);
    }
    const result: ValidationResult = { valid: true };
    return validationResultSchema.parse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown static validation error';
    const result: ValidationResult = { valid: false, errors: [message] };
    return validationResultSchema.parse(result);
  }
}

export async function fixIssuesWithGemini(jsx: string, errors: string[]): Promise<string> {
  const formattedErrors = errors.length
    ? errors.map((error, index) => `${index + 1}. ${error}`).join('\n')
    : 'No diagnostics provided';

  const prompt = `You are a senior TypeScript and React engineer. Fix the following JSX component so it passes static type-checking and renders without runtime errors.

TypeScript diagnostics and other validation output:
${formattedErrors}

Respond strictly as JSON with the same schema:
{
  "jsx": "<Corrected JSX string>",
  "notes": "optional explanation"
}

Here is the current JSX to repair:
${jsx}`;

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }]}],
    generationConfig,
  });
  const raw = result?.response?.text();
  if (!raw) {
    throw new Error('Gemini did not return fixed JSX content');
  }

  return parseJsxFromResponse(raw);
}

export type { ValidationResult };

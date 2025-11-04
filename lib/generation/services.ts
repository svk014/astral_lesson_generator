import * as ts from 'typescript';
import { z } from 'zod';

import { geminiModel } from '../gemini/client';

type ValidationResult = { valid: boolean; errors?: string[] };

const jsxResponseSchema = z.object({
  jsx: z.string().min(1, 'Gemini returned an empty JSX payload'),
  notes: z.string().optional(),
});

const generationConfig = {
  responseMimeType: 'application/json',
};

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    const fenceMatch = /^```[a-zA-Z0-9_-]*\n([\s\S]*?)```$/m.exec(trimmed);
    if (fenceMatch?.[1]) {
      return fenceMatch[1].trim();
    }
  }
  return trimmed;
}

function parseJsxFromResponse(raw: string): string {
  const sanitized = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized);
  } catch (error) {
    throw new Error(`Gemini returned invalid JSON: ${(error as Error).message}`);
  }

  const { jsx } = jsxResponseSchema.parse(parsed);
  const trimmedJsx = jsx.trim();
  if (!trimmedJsx) {
    throw new Error('Gemini returned an empty JSX string');
  }
  return trimmedJsx;
}

export async function refinePromptWithSystemMessage(outline: string): Promise<string> {
  return `You are an expert React educator. Generate a standalone JSX component for this lesson outline: "${outline}". Requirements: Output only JSX code, nothing else. Use emojis for visual elements where possible. Code must compile and render without errors. Declare exactly one top-level component and end the file with "export default <ComponentName>;". Do not emit additional exports or helpers. No external dependencies except React. The component must occupy the full viewport (set a root wrapper with minHeight 100vh and width 100%), include generous but minimalist padding, and present content in a clean, spacious layout suitable for desktop.`;
}

export async function generateJSXWithGemini(prompt: string): Promise<string> {
  const contentPrompt = `${prompt}

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
      return { valid: false, errors: messages };
    }
    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown static validation error';
    return { valid: false, errors: [message] };
  }
}

export async function validateJSXRuntime(jsx: string): Promise<ValidationResult> {
  void jsx;
  // TODO: integrate Playwright/Puppeteer to render JSX and capture runtime errors
  return { valid: true };
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

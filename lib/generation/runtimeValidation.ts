import { Stagehand } from '@browserbasehq/stagehand';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import React from 'react';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ts from 'typescript';
import { z } from 'zod';

import { geminiModel, resolvedGeminiModel } from '../gemini/client';
import type { ValidationResult } from './types';

const runtimeAssertionSchema = z.object({
  type: z.enum(['equals', 'contains', 'not_empty']),
  expected: z.string().optional(),
});

const runtimeTestCaseSchema = z.object({
  name: z.string().min(1),
  extractionPrompt: z.string().min(1),
  assertion: runtimeAssertionSchema,
});

const runtimeTestPlanSchema = z.object({
  tests: z.array(runtimeTestCaseSchema).min(1).max(5),
});

type RuntimeTestPlan = z.infer<typeof runtimeTestPlanSchema>;
type RuntimeAssertion = z.infer<typeof runtimeAssertionSchema>;

const STAGEHAND_SUPPORTED_MODELS = new Set([
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'o4-mini',
  'o3',
  'o3-mini',
  'o1',
  'o1-mini',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4o-2024-08-06',
  'gpt-4.5-preview',
  'o1-preview',
  'claude-3-5-sonnet-latest',
  'claude-3-5-sonnet-20240620',
  'claude-3-5-sonnet-20241022',
  'claude-3-7-sonnet-20250219',
  'claude-3-7-sonnet-latest',
  'cerebras-llama-3.3-70b',
  'cerebras-llama-3.1-8b',
  'groq-llama-3.3-70b-versatile',
  'groq-llama-3.3-70b-specdec',
  'moonshotai/kimi-k2-instruct',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-flash-preview-04-17',
  'gemini-2.5-pro-preview-03-25',
]);

const DEFAULT_STAGEHAND_GEMINI_MODEL = 'gemini-1.5-pro';

export const generationConfig = {
  responseMimeType: 'application/json',
};

export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    const fenceMatch = /^```[a-zA-Z0-9_-]*\n([\s\S]*?)```$/m.exec(trimmed);
    if (fenceMatch?.[1]) {
      return fenceMatch[1].trim();
    }
  }
  return trimmed;
}

function ensureDefaultExport(source: string): string {
  if (/export\s+(default\s+)?[A-Za-z]/.test(source) || /module\.exports/.test(source)) {
    return source;
  }

  const componentMatch = source.match(
    /(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^=]*\)\s*=>|function\s*\()/,
  );

  if (componentMatch?.[1]) {
    return `${source}\n\nexport default ${componentMatch[1]};`;
  }

  const functionMatch = source.match(/function\s+([A-Z][A-Za-z0-9_]*)\s*\(/);
  if (functionMatch?.[1]) {
    return `${source}\n\nexport default ${functionMatch[1]};`;
  }

  return `${source}\n\nexport default () => React.createElement('div', null, 'Generated lesson did not return a component');`;
}

function compileJsxToComponent(jsx: string): React.ComponentType {
  const prepared = ensureDefaultExport(jsx);
  const transpiled = ts.transpileModule(prepared, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: 'RuntimeLessonComponent.tsx',
    reportDiagnostics: true,
  });

  const diagnostics = transpiled.diagnostics ?? [];
  if (diagnostics.length > 0) {
    const messages = diagnostics
      .map((diag) => ts.flattenDiagnosticMessageText(diag.messageText, '\n'))
      .join('\n');
    throw new Error(`Runtime transpilation failed: ${messages}`);
  }

  const moduleLike = { exports: {} as Record<string, unknown> };

  const requireShim = (id: string) => {
    if (id === 'react') {
      return Object.assign({ default: React }, React);
    }
    if (id === 'react/jsx-runtime') {
      return Object.assign({ default: ReactJsxRuntime }, ReactJsxRuntime);
    }
    throw new Error(`Unsupported import during runtime validation: ${id}`);
  };

  const factory = new Function('exports', 'module', 'require', 'React', transpiled.outputText ?? '');
  factory(moduleLike.exports, moduleLike, requireShim, React);

  let resolved =
    (moduleLike.exports as Record<string, unknown>).default ??
    (moduleLike.exports as Record<string, unknown>).Lesson ??
    moduleLike.exports;

  if (typeof resolved !== 'function') {
    for (const value of Object.values(moduleLike.exports)) {
      if (typeof value === 'function') {
        resolved = value;
        break;
      }
    }
  }

  if (typeof resolved !== 'function') {
    throw new Error('Runtime validation could not find a component export.');
  }

  return resolved as React.ComponentType;
}

function renderJsxToStaticPage(jsx: string): string {
  const Component = compileJsxToComponent(jsx);
  const markup = renderToStaticMarkup(React.createElement(Component));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Runtime Validation Preview</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        font-family: 'Inter', system-ui, sans-serif;
        background: #0f172a;
        color: #e2e8f0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 48px;
      }
      .runtime-wrapper {
        width: min(960px, 100%);
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(148, 163, 184, 0.3);
        border-radius: 16px;
        padding: 32px;
        box-shadow: 0 30px 120px rgba(15, 23, 42, 0.45);
      }
    </style>
  </head>
  <body>
    <main class="runtime-wrapper">${markup}</main>
  </body>
</html>`;
}

function evaluateRuntimeAssertion(
  value: unknown,
  assertion: RuntimeAssertion,
): { ok: boolean; reason?: string } {
  if (typeof value !== 'string') {
    return {
      ok: false,
      reason: `Expected Stagehand extract to return string, received ${typeof value}`,
    };
  }

  const trimmed = value.trim();

  switch (assertion.type) {
    case 'equals': {
      if (typeof assertion.expected !== 'string') {
        return { ok: false, reason: 'Assertion "equals" is missing expected value.' };
      }
      const expected = assertion.expected.trim();
      if (trimmed === expected) {
        return { ok: true };
      }

      const normalizedActual = trimmed.replace(/\s+/g, ' ').trim();
      const normalizedExpected = expected.replace(/\s+/g, ' ').trim();
      if (normalizedActual === normalizedExpected) {
        return { ok: true };
      }

      const actualLines = trimmed
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (actualLines.some((line) => line === expected || line === normalizedExpected)) {
        return { ok: true };
      }

      return {
        ok: false,
        reason: `Expected "${expected}" but received "${trimmed}"`,
      };
    }
    case 'contains': {
      if (typeof assertion.expected !== 'string') {
        return { ok: false, reason: 'Assertion "contains" is missing expected value.' };
      }
      return trimmed.includes(assertion.expected.trim())
        ? { ok: true }
        : {
            ok: false,
            reason: `Value did not contain "${assertion.expected}". Received "${trimmed}"`,
          };
    }
    case 'not_empty': {
      return trimmed.length > 0
        ? { ok: true }
        : { ok: false, reason: 'Expected non-empty string result.' };
    }
    default:
      return { ok: false, reason: `Unsupported assertion type: ${assertion.type}` };
  }
}

function isRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : null;
  if (!message) {
    return false;
  }
  const normalized = message.toLowerCase();
  return normalized.includes('rate limit');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runWithRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxAttempts = 4;
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error) && attempt < maxAttempts) {
        const waitMs = 20000 * attempt;
        await sleep(waitMs);
        continue;
      }
      throw error;
    }
  }

  throw (lastError ?? new Error('Failed after rate-limit retries'));
}

async function generateRuntimeTestPlan(jsx: string): Promise<RuntimeTestPlan> {
  const instructions = `You are validating a JSX lesson component. Produce between 1 and 3 runtime tests.

Return strictly minified JSON matching:
{ "tests": [ { "name": string, "extractionPrompt": string, "assertion": { "type": "equals" | "contains" | "not_empty", "expected"?: string } } ] }

Guidelines:
- Focus on verifying meaningful UI text visible to users.
- Prompts will be executed via Stagehand's extract(textPrompt, z.string()). Ask for concise answers.
- Use "equals" only for short, standalone strings such as button labels or titles that appear exactly as-is. If there is any chance of surrounding context, punctuation, or multi-line layout, use "contains" instead.
- Use "not_empty" when checking presence without specific value.
- Do NOT include explanations or markdown.

JSX to inspect:
${jsx}`;

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: instructions }] }],
    generationConfig,
  });

  const raw = result?.response?.text();
  if (!raw) {
    throw new Error('Gemini did not return runtime validation tests.');
  }

  const sanitized = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized);
  } catch (error) {
    throw new Error(
      `Gemini returned invalid runtime test JSON: ${(error as Error).message}`,
    );
  }

  return runtimeTestPlanSchema.parse(parsed);
}

async function startRuntimePreviewServer(html: string): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    });

    server.on('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to determine runtime preview server address.'));
        return;
      }

      const { address: host, port } = address as AddressInfo;
      const url = `http://${host === '::' ? '127.0.0.1' : host}:${port}`;
      resolve({
        url,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => {
              if (err) {
                rejectClose(err);
              } else {
                resolveClose();
              }
            });
          }),
      });
    });
  });
}

export async function validateJSXRuntime(jsx: string): Promise<ValidationResult> {
  let stagehand: Stagehand | null = null;
  let previewServer: { url: string; close: () => Promise<void> } | null = null;

  try {
    const testPlan = await generateRuntimeTestPlan(jsx);
    const html = renderJsxToStaticPage(jsx);

    previewServer = await startRuntimePreviewServer(html);

    const stagehandModelOverride = process.env.STAGEHAND_MODEL?.trim();
    let stagehandModelName: string;
    if (stagehandModelOverride && stagehandModelOverride.length > 0) {
      stagehandModelName = stagehandModelOverride;
      if (!STAGEHAND_SUPPORTED_MODELS.has(stagehandModelOverride)) {
        console.warn(
          `[Stagehand] Model override "${stagehandModelOverride}" is not in the supported list. Stagehand may reject it.`,
        );
      }
    } else if (STAGEHAND_SUPPORTED_MODELS.has(resolvedGeminiModel)) {
      stagehandModelName = resolvedGeminiModel;
    } else {
      stagehandModelName = DEFAULT_STAGEHAND_GEMINI_MODEL;
      console.warn(
        `[Stagehand] Gemini model "${resolvedGeminiModel}" is not supported. Falling back to "${stagehandModelName}". Set STAGEHAND_MODEL to override.`,
      );
    }

    const stagehandApiKey = process.env.GEMINI_API_KEY;
    let stagehandModel: string | { modelName: string; apiKey: string } = stagehandModelName;
    if (/^gemini/i.test(stagehandModelName) && stagehandApiKey) {
      stagehandModel = { modelName: stagehandModelName, apiKey: stagehandApiKey };
    }

    stagehand = new Stagehand({
      env: 'LOCAL',
      cacheDir: path.resolve(process.cwd(), '.stagehand-cache'),
      model: stagehandModel,
    });
    await stagehand.init();

    const activeStagehand = stagehand;
    if (!activeStagehand) {
      throw new Error('Stagehand failed to initialize.');
    }

    const pages = activeStagehand.context.pages();
    const page = pages.length > 0 ? pages[0] : await activeStagehand.context.newPage();
    await page.goto(previewServer.url, { waitUntil: 'domcontentloaded' });

    const failures: string[] = [];

    for (const test of testPlan.tests) {
      try {
        const result = await runWithRateLimitRetry(() =>
          activeStagehand.extract(test.extractionPrompt, z.string()),
        );
        const evaluation = evaluateRuntimeAssertion(result, test.assertion);
        if (!evaluation.ok) {
          failures.push(`Test "${test.name}" failed: ${evaluation.reason}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`Test "${test.name}" errored: ${message}`);
      }
    }

    if (failures.length > 0) {
      return { valid: false, errors: failures };
    }

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, errors: [message] };
  } finally {
    if (previewServer) {
      await previewServer.close().catch(() => {
        /* swallow shutdown errors */
      });
    }
    if (stagehand) {
      await stagehand.close().catch(() => {
        /* swallow shutdown errors */
      });
    }
  }
}

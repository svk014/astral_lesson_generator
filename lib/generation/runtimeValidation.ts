import { Stagehand } from '@browserbasehq/stagehand';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import React from 'react';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ts from 'typescript';
import { z } from 'zod';

import { env } from '../env';
import { retryWithExponentialBackoff, stripJsonFence } from '../utils';
import { geminiModel } from '../gemini/client';
import {
  runtimeTestPlanSchema,
  runtimeValidationResultSchema,
  type RuntimeAssertion,
  type RuntimeTestPlan,
  type RuntimeValidationResult,
} from './schemas';

export const generationConfig = {
  responseMimeType: 'application/json',
};

const RUNTIME_TEMPLATE_PLACEHOLDER = '{{CONTENT}}';
const RUNTIME_TEMPLATE_PATH = path.resolve(
  process.cwd(),
  'lib/generation/runtime-preview.template.html',
);

const runtimePreviewTemplate = (() => {
  const template = readFileSync(RUNTIME_TEMPLATE_PATH, 'utf8');
  if (!template.includes(RUNTIME_TEMPLATE_PLACEHOLDER)) {
    throw new Error(
      `Runtime preview template missing placeholder ${RUNTIME_TEMPLATE_PLACEHOLDER} in ${RUNTIME_TEMPLATE_PATH}`,
    );
  }
  return template;
})();

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

  return runtimePreviewTemplate.replace(RUNTIME_TEMPLATE_PLACEHOLDER, markup);
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
  }
}

function isRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : null;
  return message ? message.toLowerCase().includes('rate limit') : false;
}

async function generateRuntimeTestPlan(jsx: string): Promise<RuntimeTestPlan> {
  const instructions = `You are validating a JSX lesson component. Produce between 1 and 3 runtime tests.

Return strictly minified JSON matching:
{ "tests": [ { "name": string, "extractionPrompt": string, "assertion": { "type": "equals" | "contains" | "not_empty", "expected"?: string } } ] }

Guidelines:
- Test ONLY the initial rendered content on page load. Do NOT test outcomes of user interactions (form submissions, button clicks, state changes, multi-step workflows).
- Do NOT assert on content inside conditionally rendered sections that might not be visible by default.
- Do NOT assert on outcomes of animations or transitions.
- Focus on verifying meaningful UI text that is present without any user action required.
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
  const parseResult = runtimeTestPlanSchema.safeParse(JSON.parse(sanitized));
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid runtime test plan: ${issues}`);
  }

  return parseResult.data;
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

export async function validateJSXRuntime(jsx: string): Promise<RuntimeValidationResult> {
  let stagehand: Stagehand | null = null;
  let previewServer: { url: string; close: () => Promise<void> } | null = null;

  try {
    const testPlan = await generateRuntimeTestPlan(jsx);
    const html = renderJsxToStaticPage(jsx);

    previewServer = await startRuntimePreviewServer(html);

    stagehand = new Stagehand({
      env: 'LOCAL',
      cacheDir: path.resolve(process.cwd(), '.stagehand-cache'),
      model: {
        modelName: env.stagehand.model,
        apiKey: env.openai.apiKey,
      }
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
    let testsPassed = 0;

    console.log(
      `[Stagehand] Running ${testPlan.tests.length} Gemini-generated runtime tests on JSX component...`,
    );
    for (const test of testPlan.tests) {
      try {
        console.log(`[Stagehand] Executing test: "${test.name}"`);
        const result = await retryWithExponentialBackoff(
          () => activeStagehand.extract(test.extractionPrompt, z.string()),
          {
            maxAttempts: 4,
            isRetryable: isRateLimitError,
            baseDelayMs: 20000,
            multiplier: 1,
          },
        );
        console.log(
          `[Stagehand] Test "${test.name}" extracted: "${result.substring(0, 80)}${result.length > 80 ? '...' : ''}"`,
        );

        const evaluation = evaluateRuntimeAssertion(result, test.assertion);
        if (!evaluation.ok) {
          const failMsg = `Test "${test.name}" failed: ${evaluation.reason}`;
          console.warn(`[Stagehand] ${failMsg}`);
          failures.push(failMsg);
        } else {
          testsPassed += 1;
          console.log(`[Stagehand] ✓ Test "${test.name}" passed`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const errMsg = `Test "${test.name}" errored: ${message}`;
        console.error(`[Stagehand] ${errMsg}`);
        failures.push(errMsg);
      }
    }

    console.log(
      `[Stagehand] Test results: ${testsPassed}/${testPlan.tests.length} passed`,
    );

    if (failures.length > 0) {
      const result: RuntimeValidationResult = {
        valid: false,
        errors: failures,
        testsPassed,
        testsRun: testPlan.tests.length,
        testCases: testPlan.tests,
      };
      return runtimeValidationResultSchema.parse(result);
    }

    const result: RuntimeValidationResult = {
      valid: true,
      testsPassed,
      testsRun: testPlan.tests.length,
      testCases: testPlan.tests,
    };
    return runtimeValidationResultSchema.parse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Stagehand] Fatal error during runtime validation:', message);
    const result: RuntimeValidationResult = { valid: false, errors: [message] };
    return runtimeValidationResultSchema.parse(result);
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

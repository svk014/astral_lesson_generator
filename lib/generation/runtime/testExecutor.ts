import type { Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';
import { retryWithExponentialBackoff } from '../../utils';
import type { RuntimeAssertion, RuntimeTestPlan } from '../schemas';

function isRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : null;
  return message ? message.toLowerCase().includes('rate limit') : false;
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

export interface TestExecutionResult {
  testsPassed: number;
  testsRun: number;
  failures: string[];
}

/**
 * Executes runtime tests using Stagehand on a preview server
 */
export async function executeRuntimeTests(
  stagehand: Stagehand,
  previewUrl: string,
  testPlan: RuntimeTestPlan,
): Promise<TestExecutionResult> {
  const pages = stagehand.context.pages();
  const page = pages.length > 0 ? pages[0] : await stagehand.context.newPage();
  await page.goto(previewUrl, { waitUntil: 'domcontentloaded' });

  const failures: string[] = [];
  let testsPassed = 0;

  console.log(
    `[Stagehand] Running ${testPlan.tests.length} Gemini-generated runtime tests on JSX component...`,
  );

  for (const test of testPlan.tests) {
    try {
      console.log(`[Stagehand] Executing test: "${test.name}"`);
      const result = await retryWithExponentialBackoff(
        () => stagehand.extract(test.extractionPrompt, z.string()),
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

  console.log(`[Stagehand] Test results: ${testsPassed}/${testPlan.tests.length} passed`);

  return {
    testsPassed,
    testsRun: testPlan.tests.length,
    failures,
  };
}

import type { Stagehand } from '@browserbasehq/stagehand';
import { stagehandPool } from './stagehandPool';
import { runtimeValidationResultSchema, type RuntimeValidationResult } from './schemas';
import { renderJsxToStaticPage } from './runtime/jsxRenderer';
import { startRuntimePreviewServer } from './runtime/previewServer';
import { generateRuntimeTestPlan } from './runtime/testGenerator';
import { executeRuntimeTests } from './runtime/testExecutor';
import { cleanupBrowserAndRelease } from './runtime/browserCleanup';

// Re-export for backward compatibility
export { generationConfig } from './runtime/testGenerator';

/**
 * Main orchestrator for runtime validation of JSX components
 * Coordinates test generation, browser management, and test execution
 */
export async function validateJSXRuntime(jsx: string): Promise<RuntimeValidationResult> {
  let stagehand: Stagehand | null = null;
  let previewServer: Awaited<ReturnType<typeof startRuntimePreviewServer>> | null = null;

  try {
    // Step 1: Generate test plan using Gemini
    const testPlan = await generateRuntimeTestPlan(jsx);

    // Step 2: Render JSX to static HTML
    const html = renderJsxToStaticPage(jsx);

    // Step 3: Start preview server
    previewServer = await startRuntimePreviewServer(html);

    // Step 4: Acquire browser from pool
    stagehand = await stagehandPool.acquire();
    if (!stagehand) {
      throw new Error('Stagehand failed to initialize.');
    }

    // Step 5: Execute tests
    const { testsPassed, testsRun, failures } = await executeRuntimeTests(
      stagehand,
      previewServer.url,
      testPlan,
    );

    // Step 6: Return results
    if (failures.length > 0) {
      const result: RuntimeValidationResult = {
        valid: false,
        errors: failures,
        testsPassed,
        testsRun,
        testCases: testPlan.tests,
      };
      return runtimeValidationResultSchema.parse(result);
    }

    const result: RuntimeValidationResult = {
      valid: true,
      testsPassed,
      testsRun,
      testCases: testPlan.tests,
    };
    return runtimeValidationResultSchema.parse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Stagehand] Fatal error during runtime validation:', message);
    const result: RuntimeValidationResult = { valid: false, errors: [message] };
    return runtimeValidationResultSchema.parse(result);
  } finally {
    // Always cleanup resources
    if (previewServer) {
      await previewServer.close().catch(() => {
        /* swallow shutdown errors */
      });
    }

    // Always release browser back to pool
    await cleanupBrowserAndRelease(stagehand);
  }
}

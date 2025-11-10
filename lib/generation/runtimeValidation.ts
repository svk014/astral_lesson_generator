import { Stagehand } from '@browserbasehq/stagehand';
import path from 'node:path';
import { env } from '../env';
import { runtimeValidationResultSchema, type RuntimeValidationResult } from './schemas';
import { renderJsxToStaticPage } from './runtime/jsxRenderer';
import { startRuntimePreviewServer } from './runtime/previewServer';
import { generateRuntimeTestPlan } from './runtime/testGenerator';
import { executeRuntimeTests } from './runtime/testExecutor';
export { generationConfig } from './runtime/testGenerator';

/**
 * Main orchestrator for runtime validation of JSX components
 * Creates a fresh browser instance for each validation to avoid state corruption.
 */
export async function validateJSXRuntime(jsx: string): Promise<RuntimeValidationResult> {
  let stagehand: Stagehand | null = null;
  let previewServer: Awaited<ReturnType<typeof startRuntimePreviewServer>> | null = null;

  try {
    const testPlan = await generateRuntimeTestPlan(jsx);
    const html = renderJsxToStaticPage(jsx);
    previewServer = await startRuntimePreviewServer(html);

    console.log('[Stagehand] Creating fresh browser instance...');
    stagehand = new Stagehand({
      env: 'LOCAL',
      cacheDir: path.resolve(process.cwd(), '.stagehand-cache'),
      model: {
        modelName: env.stagehand.model,
        apiKey: env.openai.apiKey,
      },
    });
    await stagehand.init();
    console.log('[Stagehand] Browser initialized');

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
    if (previewServer) {
      await previewServer.close().catch(() => {
        /* swallow shutdown errors */
      });
    }

    // Kill browser process forcefully in background (don't block execution)
    if (stagehand) {
      setTimeout(() => {
        try {
          // Get the browser process and kill it
          const browserId = (stagehand as any).browserId;
          if (browserId) {
            console.debug('[Stagehand] Force killing browser process:', browserId);
            process.kill(browserId, 'SIGKILL');
          }
        } catch (err) {
          // Ignore kill errors - process may already be gone
        }
      }, 100); // Kill after 100ms
    }
  }
}

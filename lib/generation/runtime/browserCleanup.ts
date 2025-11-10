import type { Stagehand } from '@browserbasehq/stagehand';
import { stagehandPool } from '../stagehandPool';

/**
 * Safely closes pages and releases browser back to the pool
 * Uses aggressive timeouts to prevent hanging
 */
export async function cleanupBrowserAndRelease(stagehand: Stagehand | null): Promise<void> {
  if (!stagehand) return;

  try {
    // Try to close pages with aggressive timeout, but don't let it block release
    const pages = stagehand.context.pages();
    console.log(`[Stagehand] Closing ${pages.length} page(s) before releasing browser...`);

    // Create a cleanup function that handles each page safely
    const closePageSafely = async (page: any): Promise<void> => {
      return new Promise<void>((resolve) => {
        // Timeout after 2 seconds per page - resolve no matter what
        const timeout = setTimeout(() => {
          console.debug('[Stagehand] Page close timed out (2s), continuing...');
          resolve();
        }, 2000);

        // Try to close, but always resolve
        page
          .close()
          .catch((err: Error) => {
            console.debug('[Stagehand] Page close error:', err.message);
          })
          .finally(() => {
            clearTimeout(timeout);
            resolve();
          });
      });
    };

    // Give overall cleanup 4 seconds max
    const cleanupPromise = Promise.all(pages.map(closePageSafely));
    const overallTimeout = new Promise<void>((resolve) =>
      setTimeout(() => {
        console.warn('[Stagehand] Overall cleanup timeout (4s), forcing release');
        resolve();
      }, 4000),
    );

    await Promise.race([cleanupPromise, overallTimeout]);
    console.log('[Stagehand] Page cleanup completed');
  } catch (error) {
    // Log but don't throw - we still need to release
    console.warn(
      '[Stagehand] Error during page cleanup:',
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    // GUARANTEED release - this runs no matter what happens above
    try {
      stagehandPool.release(stagehand);
      console.log('[Stagehand] Browser released back to pool');
    } catch (releaseErr) {
      console.error('[Stagehand] CRITICAL: Failed to release browser to pool:', releaseErr);
      // Browser is now stuck - this should never happen with our validation
    }
  }
}

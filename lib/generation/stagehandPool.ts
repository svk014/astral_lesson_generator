import path from 'node:path';
import { Stagehand } from '@browserbasehq/stagehand';
import { env } from '../env';

/**
 * Global Stagehand browser pool for reusing browser instances across runtime validations.
 * Eliminates the hang issue from closing/opening browsers repeatedly.
 */
class StagehandPool {
  private instances: Stagehand[] = [];
  private inUse = new Set<Stagehand>();
  private maxPoolSize = 3; // Max concurrent browsers
  private initializing = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initializing) {
      return this.initPromise!;
    }

    this.initializing = true;
    this.initPromise = this._createBrowsers();
    await this.initPromise;
  }

  private async _createBrowsers(): Promise<void> {
    try {
      // Pre-create one browser instance to have ready
      const browser = new Stagehand({
        env: 'LOCAL',
        cacheDir: path.resolve(process.cwd(), '.stagehand-cache'),
        model: {
          modelName: env.stagehand.model,
          apiKey: env.openai.apiKey,
        },
      });
      await browser.init();
      this.instances.push(browser);
      console.log('[StagehandPool] Pre-created 1 browser instance');
    } catch (error) {
      console.error('[StagehandPool] Failed to initialize pool:', error);
      throw error;
    }
  }

  async acquire(): Promise<Stagehand> {
    // Initialize on first use
    if (!this.initializing) {
      await this.initialize();
    }

    // Return available instance if exists
    if (this.instances.length > 0) {
      const browser = this.instances.pop()!;
      this.inUse.add(browser);
      console.log(`[StagehandPool] Acquired browser (${this.inUse.size} in use, ${this.instances.length} available)`);
      return browser;
    }

    // Create new instance if under limit
    if (this.inUse.size < this.maxPoolSize) {
      try {
        const browser = new Stagehand({
          env: 'LOCAL',
          cacheDir: path.resolve(process.cwd(), '.stagehand-cache'),
          model: {
            modelName: env.stagehand.model,
            apiKey: env.openai.apiKey,
          },
        });
        await browser.init();
        this.inUse.add(browser);
        console.log(`[StagehandPool] Created new browser instance (${this.inUse.size} in use)`);
        return browser;
      } catch (error) {
        console.error('[StagehandPool] Failed to create new browser instance:', error);
        throw error;
      }
    }

    // Wait for instance to be available (simple poll for now)
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.instances.length > 0) {
          clearInterval(checkInterval);
          const browser = this.instances.pop()!;
          this.inUse.add(browser);
          console.log(`[StagehandPool] Acquired available browser (${this.inUse.size} in use)`);
          resolve(browser);
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('[StagehandPool] Timeout waiting for available browser, creating new one');
        const browser = new Stagehand({
          env: 'LOCAL',
          cacheDir: path.resolve(process.cwd(), '.stagehand-cache'),
          model: {
            modelName: env.stagehand.model,
            apiKey: env.openai.apiKey,
          },
        });
        browser.init().then(() => {
          this.inUse.add(browser);
          resolve(browser);
        });
      }, 30000);
    });
  }

  release(browser: Stagehand): void {
    this.inUse.delete(browser);
    this.instances.push(browser);
    console.log(`[StagehandPool] Released browser (${this.inUse.size} in use, ${this.instances.length} available)`);
  }

  async closeAll(): Promise<void> {
    console.log('[StagehandPool] Closing all browser instances...');
    const allBrowsers = [...this.instances, ...this.inUse];
    this.instances = [];
    this.inUse.clear();

    for (const browser of allBrowsers) {
      try {
        await browser.close().catch(() => {
          /* ignore close errors */
        });
      } catch (error) {
        console.warn('[StagehandPool] Error closing browser:', error);
      }
    }
    console.log('[StagehandPool] All browsers closed');
  }
}

export const stagehandPool = new StagehandPool();

#!/usr/bin/env tsx

import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';

import {
  refinePromptWithSystemMessage,
  generateJSXWithGemini,
  validateJSXStatic,
  validateJSXRuntime,
  fixIssuesWithGemini,
} from '../lib/generation/services';
import { runLessonGeneration } from '../lib/generation/runner';

const SANDBOX_DIR = path.resolve(process.cwd(), 'sandbox');
const OUTPUT_FILE = path.join(SANDBOX_DIR, 'output.jsx');
const LOG_FILE = path.join(SANDBOX_DIR, 'logs.json');

async function ensureSandboxDir() {
  await fs.mkdir(SANDBOX_DIR, { recursive: true }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  });
}

type CliOptions = {
  outline?: string;
  outlinePath?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--outline' || arg === '-o') {
      options.outline = argv[i + 1];
      i += 1;
    } else if (arg === '--outline-file' || arg === '-f') {
      options.outlinePath = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

async function getOutline(options: CliOptions): Promise<string> {
  if (options.outline) {
    return options.outline;
  }
  if (options.outlinePath) {
    const absolutePath = path.resolve(process.cwd(), options.outlinePath);
    return fs.readFile(absolutePath, 'utf-8');
  }
  throw new Error('Provide an outline via --outline "text" or --outline-file path/to/file.md');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outline = (await getOutline(options)).trim();

  if (!outline) {
    throw new Error('Outline is empty after trimming.');
  }

  await ensureSandboxDir();

  const outcome = await runLessonGeneration(
    { outline },
    {
      refinePrompt: refinePromptWithSystemMessage,
      generateJSX: generateJSXWithGemini,
      validateJSXStatic,
      validateJSXRuntime,
      fixIssues: fixIssuesWithGemini,
    },
    {
      hooks: {
        recordLog: (entry) => {
          const prefix = `[${entry.timestamp}] attempt=${entry.attempt} step=${entry.step}`;
          const suffix = entry.status === 'success' ? '✅' : '❌';
          const maybeInfo = entry.info ? ` info=${JSON.stringify(entry.info)}` : '';
          console.log(`${prefix} status=${entry.status}${maybeInfo} ${suffix}`);
        },
        onSuccess: async ({ jsx, attempt }) => {
          await fs.writeFile(OUTPUT_FILE, jsx, 'utf-8');
          console.log(`\n✅ Generation succeeded in attempt ${attempt}. JSX written to ${OUTPUT_FILE}.`);
        },
        onFailure: async ({ error, lastJsx }) => {
          if (lastJsx) {
            await fs.writeFile(OUTPUT_FILE, lastJsx, 'utf-8');
          }
          console.error(`\n❌ Generation failed: ${error}`);
        },
      },
    },
  );

  await fs.writeFile(LOG_FILE, JSON.stringify(outcome.logs, null, 2), 'utf-8');

  if (outcome.status === 'failed') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Harness execution failed:', error);
  process.exitCode = 1;
});

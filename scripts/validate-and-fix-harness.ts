#!/usr/bin/env tsx

import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  validateJSXStatic,
  validateJSXRuntime,
  fixIssuesWithGemini,
} from '../lib/generation/services';
import { HarnessLogger, ValidationErrors } from './utils/harnessLogger';

const SANDBOX_DIR = path.resolve(process.cwd(), 'sandbox');
const OUTPUT_FILE = path.join(SANDBOX_DIR, 'output.jsx');
const MAX_FIX_ATTEMPTS = 3;

interface FixContext {
  attempt: number;
  currentJsx: string;
  errors: ValidationErrors;
  logger: HarnessLogger;
}

async function readJsxFileOrExit(filePath: string, logger: HarnessLogger): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    logger.readFailure(err);
    process.exit(1);
  }
}

async function applyFix({
  attempt,
  currentJsx,
  errors,
  logger,
}: FixContext): Promise<{ attempt: number; jsx: string }> {
  const nextAttempt = attempt + 1;
  const updatedJsx = await fixIssuesWithGemini(currentJsx, errors ?? []);
  await fs.writeFile(OUTPUT_FILE, updatedJsx, 'utf-8');
  logger.savedCandidate(nextAttempt);

  return { attempt: nextAttempt, jsx: updatedJsx };
}

async function main() {
  const logger = new HarnessLogger(OUTPUT_FILE, MAX_FIX_ATTEMPTS);
  const jsxPath = process.argv[2];
  if (!jsxPath) {
    logger.showUsage();
    process.exit(1);
  }

  let currentJsx = await readJsxFileOrExit(jsxPath, logger);
  let attempt = 0;

  while (attempt < MAX_FIX_ATTEMPTS) {
    const staticResult = await validateJSXStatic(currentJsx);
    if (!staticResult.valid) {
      if (logger.staticFailure(attempt, staticResult.errors)) {
        process.exit(1);
      }

      const fixResult = await applyFix({
        attempt,
        currentJsx,
        errors: staticResult.errors,
        logger,
      });

      attempt = fixResult.attempt;
      currentJsx = fixResult.jsx;
      continue;
    }

    logger.staticSuccess(attempt);

    const runtimeResult = await validateJSXRuntime(currentJsx);
    if (runtimeResult.valid) {
      logger.runtimeSuccess();
      await fs.writeFile(OUTPUT_FILE, currentJsx, 'utf-8');
      process.exit(0);
    }

    if (logger.runtimeFailure(attempt, runtimeResult.errors)) {
      process.exit(1);
    }

    const fixResult = await applyFix({
      attempt,
      currentJsx,
      errors: runtimeResult.errors,
      logger,
    });

    attempt = fixResult.attempt;
    currentJsx = fixResult.jsx;
  }

  logger.exhaustedAttempts();
  process.exit(1);
}

main().catch((err) => {
  console.error('Harness execution failed:', err);
  process.exit(1);
});

#!/usr/bin/env tsx

import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  validateJSXStatic,
  validateJSXRuntime,
  fixIssuesWithGemini,
} from '../lib/generation/services';

const SANDBOX_DIR = path.resolve(process.cwd(), 'sandbox');
const OUTPUT_FILE = path.join(SANDBOX_DIR, 'output.jsx');
const MAX_FIX_ATTEMPTS = 3;

async function main() {
  const jsxPath = process.argv[2];
  if (!jsxPath) {
    console.error('Usage: bun run validate-and-fix-harness <jsx-file-path>');
    process.exit(1);
  }

  let jsx;
  try {
    jsx = await fs.readFile(jsxPath, 'utf-8');
  } catch (err) {
    console.error('Failed to read JSX file:', err);
    process.exit(1);
  }

  let currentJsx = jsx;
  let attempt = 0;

  while (attempt <= MAX_FIX_ATTEMPTS) {
    const staticResult = await validateJSXStatic(currentJsx);
    if (!staticResult.valid) {
      if (attempt === MAX_FIX_ATTEMPTS) {
        console.error('Static validation failed after maximum fix attempts:');
        for (const error of staticResult.errors ?? []) {
          console.error(`• ${error}`);
        }
        process.exit(1);
      }

      console.log('Static validation failed. Attempting to fix with Gemini...');
      currentJsx = await fixIssuesWithGemini(currentJsx, staticResult.errors ?? []);
      attempt += 1;
      await fs.writeFile(OUTPUT_FILE, currentJsx, 'utf-8');
      console.log(`Attempt ${attempt}: candidate written to ${OUTPUT_FILE}`);
      continue;
    }

    if (attempt === 0) {
      console.log('Static validation passed. Running runtime checks powered by Gemini + Stagehand...');
    } else {
      console.log('Static validation passed after fixes. Re-running runtime checks powered by Gemini + Stagehand...');
    }

    const runtimeResult = await validateJSXRuntime(currentJsx);
    if (runtimeResult.valid) {
      console.log('Runtime tests passed. JSX is ready.');
      await fs.writeFile(OUTPUT_FILE, currentJsx, 'utf-8');
      process.exit(0);
    }

    if (attempt === MAX_FIX_ATTEMPTS) {
      console.error('Runtime validation failed after maximum fix attempts:');
      for (const error of runtimeResult.errors ?? []) {
        console.error(`• ${error}`);
      }
      process.exit(1);
    }

    console.error('Runtime validation failed:');
    for (const error of runtimeResult.errors ?? []) {
      console.error(`• ${error}`);
    }
    console.log('Attempting to repair runtime issues with Gemini...');
    currentJsx = await fixIssuesWithGemini(currentJsx, runtimeResult.errors ?? []);
    attempt += 1;
    await fs.writeFile(OUTPUT_FILE, currentJsx, 'utf-8');
    console.log(`Attempt ${attempt}: candidate written to ${OUTPUT_FILE}`);
  }

  console.error('Exceeded maximum fix attempts.');
  process.exit(1);
}

main().catch((err) => {
  console.error('Harness execution failed:', err);
  process.exit(1);
});

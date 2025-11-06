import { randomUUID, createHash } from 'node:crypto';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateShortHash(): string {
  return createHash('sha256').update(randomUUID()).digest('hex').substring(0, 12);
}

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

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    isRetryable?: (error: unknown) => boolean;
    baseDelayMs?: number;
    multiplier?: number;
  },
): Promise<T> {
  const {
    maxAttempts = 4,
    isRetryable = () => false,
    baseDelayMs = 20000,
    multiplier = 1,
  } = options ?? {};

  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isRetryable(error) && attempt < maxAttempts) {
        const waitMs = baseDelayMs * multiplier * attempt;
        await sleep(waitMs);
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error('Failed after maximum retry attempts');
}

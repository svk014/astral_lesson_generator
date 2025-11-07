import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../env";
import { retryWithExponentialBackoff } from "../utils";

const DEFAULT_MODEL = env.gemini.model;

function isRetryableGeminiError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	// Retry on service unavailable, rate limits, and timeouts
	return (
		message.includes('503') ||
		message.includes('Service Unavailable') ||
		message.includes('429') ||
		message.includes('Too Many Requests') ||
		message.includes('RESOURCE_EXHAUSTED') ||
		message.includes('timeout') ||
		message.includes('DEADLINE_EXCEEDED')
	);
}

const gemini = new GoogleGenerativeAI(env.gemini.apiKey);
const baseModel = gemini.getGenerativeModel({ model: DEFAULT_MODEL });
export const resolvedGeminiModel = DEFAULT_MODEL;

/**
 * Wrapper around Gemini model with automatic retry logic for transient failures
 */
export const geminiModel = {
	generateContent: async (
		request: Parameters<typeof baseModel.generateContent>[0],
	) => {
		return retryWithExponentialBackoff(
			() => baseModel.generateContent(request),
			{
				maxAttempts: 3,
				isRetryable: isRetryableGeminiError,
				baseDelayMs: 1000,
				multiplier: 2,
			},
		);
	},
	generateContentStream: async (
		request: Parameters<typeof baseModel.generateContentStream>[0],
	) => {
		return retryWithExponentialBackoff(
			() => baseModel.generateContentStream(request),
			{
				maxAttempts: 3,
				isRetryable: isRetryableGeminiError,
				baseDelayMs: 1000,
				multiplier: 2,
			},
		);
	},
};


import { GoogleGenerativeAI } from "@google/generative-ai";
import { retryWithExponentialBackoff } from "../utils";

const apiKey = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = "gemini-2.5-flash";
const supportedModels = new Set([
	"gemini-2.5-pro",
    "gemini-2.5-flash",
]);

if (!apiKey) throw new Error("GEMINI_API_KEY not set");

const requestedModel = process.env.GEMINI_MODEL?.trim();
const model = requestedModel && supportedModels.has(requestedModel)
	? requestedModel
	: DEFAULT_MODEL;

if (requestedModel && model !== requestedModel) {
	console.warn(
		`[Gemini] Unsupported model "${requestedModel}". Falling back to "${model}". Available options: ${[...supportedModels]
			.map((m) => `"${m}"`)
			.join(", ")}.`,
	);
}

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

const gemini = new GoogleGenerativeAI(apiKey);
const baseModel = gemini.getGenerativeModel({ model });
export const resolvedGeminiModel = model;

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


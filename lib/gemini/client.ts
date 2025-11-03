import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = "gemini-1.5-pro";
const supportedModels = new Set([
	"gemini-2.5-pro",
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

export const gemini = new GoogleGenerativeAI(apiKey);
export const geminiModel = gemini.getGenerativeModel({ model });
export const resolvedGeminiModel = model;

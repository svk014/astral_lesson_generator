/**
 * Centralized environment variable validation and configuration.
 * All environment variables are validated at startup to fail fast if critical config is missing.
 * This module should be imported early in the application lifecycle.
 */

/**
 * Helper to require an environment variable and throw an error if missing.
 * @param name The environment variable name (for error messages)
 * @param value The value to validate
 * @returns The validated value
 * @throws Error if value is undefined or empty string
 */
function requireEnv(name: string, value: string | undefined): string {
	if (!value || value.trim() === '') {
		throw new Error(`Environment variable "${name}" is required but not set or empty`);
	}
	return value.trim();
}

/**
 * Helper to optionally get an environment variable with a fallback default.
 * @param name The environment variable name (for logging)
 * @param value The value to check
 * @param defaultValue The fallback value if not provided
 * @returns The value or default
 */
function optionalEnv(name: string, value: string | undefined, defaultValue: string): string {
	if (!value || value.trim() === '') {
		console.debug(`[Env] Using default for "${name}": ${defaultValue}`);
		return defaultValue;
	}
	return value.trim();
}

/**
 * Helper to parse boolean environment variables.
 * @param value The value to parse (should be "true" or "false")
 * @param defaultValue The fallback value if not provided
 * @returns The parsed boolean
 */
function booleanEnv(value: string | undefined, defaultValue: boolean): boolean {
	if (value === undefined) return defaultValue;
	return value.toLowerCase() === 'true';
}

/**
 * Validates that a model is in the supported list.
 * @param model The model to validate
 * @param supported Set of supported model names
 * @param defaultModel The fallback model if invalid
 * @returns The valid model name
 */
function validateModel(
	model: string | undefined,
	supported: Set<string>,
	defaultModel: string,
): string {
	if (!model || model.trim() === '') {
		return defaultModel;
	}

	const trimmed = model.trim();
	if (supported.has(trimmed)) {
		return trimmed;
	}

	console.warn(
		`[Env] Unsupported model "${trimmed}". Falling back to "${defaultModel}". ` +
		`Available options: ${[...supported].map((m) => `"${m}"`).join(', ')}.`,
	);
	return defaultModel;
}

// ============================================================================
// SUPABASE CONFIGURATION
// ============================================================================

const SUPABASE_URL = requireEnv(
	'NEXT_PUBLIC_SUPABASE_URL',
	process.env.NEXT_PUBLIC_SUPABASE_URL,
);

// Server-side operations use service role key (private, must not be exposed to client)
const SUPABASE_SERVICE_KEY = requireEnv(
	'NEXT_PRIVATE_SUPABASE_SECRET_KEY',
	process.env.NEXT_PRIVATE_SUPABASE_SECRET_KEY,
);

// Storage bucket for lesson artifacts (JSX files, images, etc.)
const SUPABASE_STORAGE_BUCKET = optionalEnv(
	'SUPABASE_STORAGE_BUCKET',
	process.env.SUPABASE_STORAGE_BUCKET,
	'lessons',
);

// ============================================================================
// TEMPORAL WORKFLOW CONFIGURATION
// ============================================================================

const TEMPORAL_ADDRESS = requireEnv(
	'TEMPORAL_ADDRESS',
	process.env.TEMPORAL_ADDRESS,
);

const TEMPORAL_NAMESPACE = requireEnv(
	'TEMPORAL_NAMESPACE',
	process.env.TEMPORAL_NAMESPACE,
);

const TEMPORAL_TASK_QUEUE = requireEnv(
	'TEMPORAL_TASK_QUEUE',
	process.env.TEMPORAL_TASK_QUEUE,
);

const TEMPORAL_WORKFLOW_TYPE = requireEnv(
	'TEMPORAL_WORKFLOW_TYPE',
	process.env.TEMPORAL_WORKFLOW_TYPE,
);

// Optional: API key for Temporal Cloud authentication
const TEMPORAL_API_KEY = process.env.TEMPORAL_API_KEY;

// Optional: Disable TLS for local development
const TEMPORAL_TLS_DISABLED = booleanEnv(
	process.env.TEMPORAL_TLS_DISABLED,
	false,
);

// ============================================================================
// GEMINI / GOOGLE GENERATIVE AI CONFIGURATION
// ============================================================================

const GEMINI_API_KEY = requireEnv(
	'GEMINI_API_KEY',
	process.env.GEMINI_API_KEY,
);

const SUPPORTED_GEMINI_MODELS = new Set([
	'gemini-2.5-pro',
	'gemini-2.5-flash',
]);

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const GEMINI_MODEL = validateModel(
	process.env.GEMINI_MODEL,
	SUPPORTED_GEMINI_MODELS,
	DEFAULT_GEMINI_MODEL,
);

// ============================================================================
// STAGEHAND / RUNTIME VALIDATION CONFIGURATION
// ============================================================================

// OpenAI API key is required for Stagehand runtime validation
const OPENAI_API_KEY = requireEnv(
	'OPENAI_API_KEY',
	process.env.OPENAI_API_KEY,
);

const SUPPORTED_STAGEHAND_MODELS = new Set([
	'gpt-4o',
	'gpt-4o-mini',
	'gpt-4-turbo',
]);

const DEFAULT_STAGEHAND_MODEL = 'gpt-4o-mini';

const STAGEHAND_MODEL = validateModel(
	process.env.STAGEHAND_MODEL,
	SUPPORTED_STAGEHAND_MODELS,
	DEFAULT_STAGEHAND_MODEL,
);

// ============================================================================
// APPLICATION CONFIGURATION
// ============================================================================

const NEXT_PUBLIC_SITE_URL = optionalEnv(
	'NEXT_PUBLIC_SITE_URL',
	process.env.NEXT_PUBLIC_SITE_URL,
	'http://localhost:3000',
);

// ============================================================================
// EXPORT VALIDATED ENV CONFIGURATION
// ============================================================================

/**
 * Centralized, type-safe environment configuration.
 * All values are validated at module load time.
 */
export const env = {
	// Supabase
	supabase: {
		url: SUPABASE_URL,
		serviceKey: SUPABASE_SERVICE_KEY,
		storageBucket: SUPABASE_STORAGE_BUCKET,
	},

	// Temporal
	temporal: {
		address: TEMPORAL_ADDRESS,
		namespace: TEMPORAL_NAMESPACE,
		taskQueue: TEMPORAL_TASK_QUEUE,
		workflowType: TEMPORAL_WORKFLOW_TYPE,
		apiKey: TEMPORAL_API_KEY,
		tlsDisabled: TEMPORAL_TLS_DISABLED,
	},

	// Gemini
	gemini: {
		apiKey: GEMINI_API_KEY,
		model: GEMINI_MODEL,
		supportedModels: SUPPORTED_GEMINI_MODELS,
	},

	// OpenAI / Stagehand
	openai: {
		apiKey: OPENAI_API_KEY,
	},

	stagehand: {
		model: STAGEHAND_MODEL,
		supportedModels: SUPPORTED_STAGEHAND_MODELS,
	},

	// Application
	app: {
		siteUrl: NEXT_PUBLIC_SITE_URL,
	},
} as const;

/**
 * Log which environment we're running in (useful for debugging).
 * Should be called early in application startup.
 */
export function logEnvConfiguration(): void {
	console.log('[Env] Configuration loaded successfully:', {
		supabase: {
			url: SUPABASE_URL.substring(0, 20) + '...',
			bucket: SUPABASE_STORAGE_BUCKET,
		},
		temporal: {
			address: TEMPORAL_ADDRESS,
			namespace: TEMPORAL_NAMESPACE,
			tlsDisabled: TEMPORAL_TLS_DISABLED,
		},
		gemini: {
			model: GEMINI_MODEL,
		},
		stagehand: {
			model: STAGEHAND_MODEL,
		},
		app: {
			siteUrl: NEXT_PUBLIC_SITE_URL,
		},
	});
}

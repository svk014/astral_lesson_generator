// Environment variable validation and configuration helpers
function requireEnv(name: string, value: string | undefined): string {
	if (!value || value.trim() === '') {
		throw new Error(`Environment variable "${name}" is required but not set or empty`);
	}
	return value.trim();
}

function optionalEnv(name: string, value: string | undefined, defaultValue: string): string {
	if (!value || value.trim() === '') {
		console.debug(`[Env] Using default for "${name}": ${defaultValue}`);
		return defaultValue;
	}
	return value.trim();
}

function booleanEnv(value: string | undefined, defaultValue: boolean): boolean {
	if (value === undefined) return defaultValue;
	return value.toLowerCase() === 'true';
}

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

// Supabase configuration
const SUPABASE_URL = requireEnv(
	'NEXT_PUBLIC_SUPABASE_URL',
	process.env.NEXT_PUBLIC_SUPABASE_URL,
);

const SUPABASE_SERVICE_KEY = requireEnv(
	'NEXT_PRIVATE_SUPABASE_SECRET_KEY',
	process.env.NEXT_PRIVATE_SUPABASE_SECRET_KEY,
);

const SUPABASE_STORAGE_BUCKET = optionalEnv(
	'SUPABASE_STORAGE_BUCKET',
	process.env.SUPABASE_STORAGE_BUCKET,
	'lessons',
);

// Temporal configuration
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

const TEMPORAL_API_KEY = process.env.TEMPORAL_API_KEY;
const TEMPORAL_TLS_DISABLED = booleanEnv(
	process.env.TEMPORAL_TLS_DISABLED,
	false,
);

// Gemini configuration
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

// OpenAI / Stagehand configuration
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

// Application configuration
const NEXT_PUBLIC_SITE_URL = optionalEnv(
	'NEXT_PUBLIC_SITE_URL',
	process.env.NEXT_PUBLIC_SITE_URL,
	'http://localhost:3000',
);

// Centralized, type-safe environment configuration (validated at module load time)
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

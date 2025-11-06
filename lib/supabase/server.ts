import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string, value: string | undefined) {
	if (!value) {
		throw new Error(`${name} is required`);
	}

	return value;
}

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
const serviceRoleKey = requireEnv(
	'NEXT_PRIVATE_SUPABASE_SECRET_KEY',
	process.env.NEXT_PRIVATE_SUPABASE_SECRET_KEY,
);

let cachedClient: SupabaseClient | null = null;

export function getServiceSupabaseClient() {
	if (!cachedClient) {
		cachedClient = createClient(supabaseUrl, serviceRoleKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false,
			},
		});
	}

	return cachedClient;
}

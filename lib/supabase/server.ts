import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';

let cachedClient: SupabaseClient | null = null;

export function getServiceSupabaseClient() {
	if (!cachedClient) {
		cachedClient = createClient(env.supabase.url, env.supabase.serviceKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false,
			},
		});
	}

	return cachedClient;
}

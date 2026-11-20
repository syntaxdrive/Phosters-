import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

function validateSupabaseConfig(url: string, key: string): string | null {
  if (!url || !key) {
    return 'Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured.';
  }

  if (
    url.includes('YOUR_PROJECT') ||
    key.includes('YOUR_SUPABASE') ||
    key.includes('YOUR_PUBLIC_ANON')
  ) {
    return 'Supabase environment variables still contain placeholder values. Replace them with your real project URL and anon key.';
  }

  try {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const isLocalHttp = parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (!isHttps && !isLocalHttp) {
      return 'VITE_SUPABASE_URL must use https:// (or http://localhost for local development).';
    }
  } catch {
    return 'VITE_SUPABASE_URL is not a valid URL.';
  }

  return null;
}

export const supabaseConfigError = validateSupabaseConfig(rawUrl, rawAnonKey);
export const isSupabaseConfigured = supabaseConfigError === null;

// Only the public anon/publishable key is ever used in browser code.
// Never place the Supabase service-role key in VITE_* variables or frontend files.
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(rawUrl, rawAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
